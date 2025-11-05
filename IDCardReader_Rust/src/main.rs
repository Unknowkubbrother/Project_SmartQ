use pcsc::*;
use encoding_rs::WINDOWS_874;
use regex::Regex;
use std::{error::Error, time::Duration, thread};

#[derive(Clone, Copy, Debug)]
struct ApduField {
    key: &'static str,
    desc: &'static str,
    apdu: &'static [u8],
}

const APDU_LIST: &[ApduField] = &[
    ApduField { key: "CID",         desc: "เลขบัตรประชาชน",     apdu: &[0x80,0xB0,0x00,0x04,0x02,0x00,0x0D] },
    ApduField { key: "FULLNAME-TH", desc: "ชื่อ-นามสกุล(TH)",   apdu: &[0x80,0xB0,0x00,0x11,0x02,0x00,0x64] },
    ApduField { key: "FULLNAME-EN", desc: "ชื่อ-นามสกุล(EN)",   apdu: &[0x80,0xB0,0x00,0x75,0x02,0x00,0x64] },
    ApduField { key: "BIRTH",       desc: "วันเดือนปีเกิด",      apdu: &[0x80,0xB0,0x00,0xD9,0x02,0x00,0x08] },
    ApduField { key: "GENDER",      desc: "เพศ",                apdu: &[0x80,0xB0,0x00,0xE1,0x02,0x00,0x01] },
    ApduField { key: "RELIGION",    desc: "ศาสนา",              apdu: &[0x80,0xB0,0x01,0x77,0x02,0x00,0x02] },
    ApduField { key: "ADDRESS",     desc: "ที่อยู่",             apdu: &[0x80,0xB0,0x15,0x79,0x02,0x00,0x64] },
    ApduField { key: "ISSUER",      desc: "ผู้ออกบัตร",          apdu: &[0x80,0xB0,0x00,0xF6,0x02,0x00,0x64] },
    ApduField { key: "ISSUE",       desc: "วันเริ่มใช้บัตร",    apdu: &[0x80,0xB0,0x01,0x67,0x02,0x00,0x08] },
    ApduField { key: "EXPIRE",      desc: "วันหมดอายุบัตร",    apdu: &[0x80,0xB0,0x01,0x6F,0x02,0x00,0x08] },
    ApduField { key: "DOCNO",       desc: "เลขใต้บัตร",         apdu: &[0x80,0xB0,0x16,0x19,0x02,0x00,0x0E] },
];

const DELAY_CONNECT_MS: u64 = 100;
const DELAY_AFTER_CONNECT_MS: u64 = 300;
const DELAY_AFTER_DISCONNECT_MS: u64 = 250;

fn decode_tis620(data: &[u8]) -> String {
    let (cow, _, _) = WINDOWS_874.decode(data);
    cow.trim_matches(char::from(0)).trim().to_string()
}

fn convert_date(txt: &str) -> String {
    if txt.len() == 8 {
        format!("{}/{}/{}", &txt[6..8], &txt[4..6], &txt[0..4])
    } else {
        txt.to_string()
    }
}

fn select_thai_id(card: &Card) -> Result<(), Box<dyn Error>> {
    let select_applet: [u8; 13] = [
        0x00, 0xA4, 0x04, 0x00, 0x08,
        0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01,
    ];
    let mut buf = [0; MAX_BUFFER_SIZE];
    let rapdu = card.transmit(&select_applet, &mut buf)?;
    let (sw1, sw2) = (rapdu[rapdu.len() - 2], rapdu[rapdu.len() - 1]);

    match sw1 {
        0x61 => {
            let get_resp = [0x00, 0xC0, 0x00, 0x00, sw2];
            let rapdu2 = card.transmit(&get_resp, &mut buf)?;
            if rapdu2.ends_with(&[0x90, 0x00]) { Ok(()) }
            else { Err(format!("GET RESPONSE failed: {:02X?}", rapdu2).into()) }
        }
        0x90 if sw2 == 0x00 => Ok(()),
        _ => Err(format!("SELECT failed: {:02X} {:02X}", sw1, sw2).into()),
    }
}

fn read_apdu(card: &Card, apdu: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut buf = [0; MAX_BUFFER_SIZE];
    let rapdu = card.transmit(apdu, &mut buf)?;
    let (sw1, sw2) = (rapdu[rapdu.len() - 2], rapdu[rapdu.len() - 1]);

    match sw1 {
        0x61 => {
            let get_resp = [0x00, 0xC0, 0x00, 0x00, sw2];
            let rapdu2 = card.transmit(&get_resp, &mut buf)?;
            if rapdu2.len() >= 2 { Ok(rapdu2[..rapdu2.len()-2].to_vec()) }
            else { Err("Invalid GET RESPONSE".into()) }
        }
        0x90 if sw2 == 0x00 => Ok(rapdu[..rapdu.len()-2].to_vec()),
        _ => Err(format!("APDU SW error: {:02X} {:02X}", sw1, sw2).into()),
    }
}

fn parse_field(key: &str, raw: &[u8], gender: &[&str], religion: &[&str]) -> String {
    let text = decode_tis620(raw);
    match key {
        "BIRTH" | "ISSUE" | "EXPIRE" => convert_date(&text),
        "GENDER" => text.parse::<usize>().ok().and_then(|i| gender.get(i)).unwrap_or(&text.as_str()).to_string(),
        "RELIGION" => text.parse::<usize>().ok().and_then(|i| religion.get(i)).unwrap_or(&text.as_str()).to_string(),
        _ => text,
    }
}

fn process_card(card: Card, re: &Regex, gender: &[&str], religion: &[&str]) {
    thread::sleep(Duration::from_millis(DELAY_AFTER_CONNECT_MS));

    match select_thai_id(&card) {
        Ok(_) => println!("✅ เลือกแอปบัตรประชาชนสำเร็จ"),
        Err(e) => {
            println!("❌ เลือกแอปไม่สำเร็จ: {}", e);
            let _ = card.disconnect(Disposition::LeaveCard);
            thread::sleep(Duration::from_millis(DELAY_AFTER_DISCONNECT_MS));
            return;
        }
    }

    for field in APDU_LIST {
        match read_apdu(&card, field.apdu) {
            Ok(raw) => {
                let parsed = parse_field(field.key, &raw, gender, religion);
                let clean = re.replace_all(&parsed, " ");
                println!("📄 {}: {}", field.desc, clean);
            }
            Err(e) => println!("❌ อ่าน {} ไม่ได้: {}", field.desc, e),
        }
    }

    println!("✅ อ่านข้อมูลบัตรประชาชนครบแล้ว!");
    let _ = card.disconnect(Disposition::LeaveCard);
    thread::sleep(Duration::from_millis(DELAY_AFTER_DISCONNECT_MS));
}

fn run_loop(ctx: &Context) -> Result<(), Box<dyn Error>> {
    let gender = ["-", "ชาย", "หญิง"];
    let religion = ["-","พุทธ","อิสลาม","คริสต์","พราหมณ์-ฮินดู","ซิกข์","ยิว","เชน",
                    "โซโรอัสเตอร์","บาไฮ","ไม่นับถือศาสนา","ไม่ทราบ"];
    let re = Regex::new(r"#+")?;

    let readers = ctx.list_readers_owned()?;
    if readers.is_empty() {
        println!("❌ ไม่พบเครื่องอ่านบัตร");
        return Ok(());
    }
    let reader_name = &readers[0];
    println!("🖴 ใช้งาน Reader: {}", reader_name.to_string_lossy());

    let mut states = [ReaderState::new(reader_name.as_c_str(), State::UNAWARE)];
    loop {
        ctx.get_status_change(Some(Duration::from_secs(1)), &mut states)?;

        for state in &mut states {
            // card inserted
            if state.event_state().contains(State::PRESENT)
                && !state.current_state().contains(State::PRESENT)
            {
                println!("\n[ระบบ] ตรวจพบบัตร → เริ่มอ่านข้อมูล...");
                thread::sleep(Duration::from_millis(DELAY_CONNECT_MS));

                if let Ok(card) = ctx.connect(reader_name.as_c_str(), ShareMode::Shared, Protocols::ANY) {
                    process_card(card, &re, &gender, &religion);
                } else {
                    println!("❌ [ระบบ] เชื่อมต่อบัตรไม่สำเร็จ (อาจจะยังไม่เสถียร)");
                }
            }
            // card removed
            else if state.event_state().contains(State::EMPTY)
                && state.current_state().contains(State::PRESENT)
            {
                println!("\n[ระบบ] บัตรถูกถอดออกแล้ว");
            }
        }

        states = [ReaderState::new(reader_name.as_c_str(), states[0].event_state())];
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    let ctx = Context::establish(Scope::User)?;
    run_loop(&ctx)
}