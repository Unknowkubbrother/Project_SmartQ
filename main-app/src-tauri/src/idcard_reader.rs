use pcsc::{
    Context, Card, ReaderState, Scope, ShareMode, Protocols, Disposition, MAX_BUFFER_SIZE, Error as PcscError, State,
};
use encoding_rs::WINDOWS_874;
use regex::Regex;
use std::time::Duration;
use std::thread;
use tauri::{AppHandle,Emitter};
use base64::{Engine as _, engine::general_purpose};

type AppResult<T> = Result<T, Box<dyn std::error::Error>>;

#[derive(Clone, Copy, Debug)]
struct ApduField {
    key: &'static str,
    desc: &'static str,
    apdu: &'static [u8],
}

#[derive(Clone, Copy, Debug)]
struct ApduPHOTO {
    key: &'static str,
    apdu: &'static [u8],
}

const APDU_LIST: &[ApduField] = &[
    ApduField { key: "CID",         desc: "เลขบัตรประชาชน",     apdu: &[0x80,0xB0,0x00,0x04,0x02,0x00,0x0D] },
    ApduField { key: "FULLNAME_TH", desc: "ชื่อ-นามสกุล(TH)",   apdu: &[0x80,0xB0,0x00,0x11,0x02,0x00,0x64] },
    ApduField { key: "FULLNAME_EN", desc: "ชื่อ-นามสกุล(EN)",   apdu: &[0x80,0xB0,0x00,0x75,0x02,0x00,0x64] },
    ApduField { key: "BIRTH",       desc: "วันเดือนปีเกิด",      apdu: &[0x80,0xB0,0x00,0xD9,0x02,0x00,0x08] },
    ApduField { key: "GENDER",      desc: "เพศ",                apdu: &[0x80,0xB0,0x00,0xE1,0x02,0x00,0x01] },
    ApduField { key: "RELIGION",    desc: "ศาสนา",              apdu: &[0x80,0xB0,0x01,0x77,0x02,0x00,0x02] },
    ApduField { key: "ADDRESS",     desc: "ที่อยู่",             apdu: &[0x80,0xB0,0x15,0x79,0x02,0x00,0x64] },
    ApduField { key: "ISSUER",      desc: "ผู้ออกบัตร",          apdu: &[0x80,0xB0,0x00,0xF6,0x02,0x00,0x64] },
    ApduField { key: "ISSUE",       desc: "วันเริ่มใช้บัตร",    apdu: &[0x80,0xB0,0x01,0x67,0x02,0x00,0x08] },
    ApduField { key: "EXPIRE",      desc: "วันหมดอายุบัตร",    apdu: &[0x80,0xB0,0x01,0x6F,0x02,0x00,0x08] },
    ApduField { key: "DOCNO",       desc: "เลขใต้บัตร",         apdu: &[0x80,0xB0,0x16,0x19,0x02,0x00,0x0E] },
];

const APDU_PHOTO: &[ApduPHOTO] = &[
    ApduPHOTO { key: "APDU_PHOTO1",  apdu: &[0x80, 0xB0, 0x01, 0x7B, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO2",  apdu: &[0x80, 0xB0, 0x02, 0x7A, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO3",  apdu: &[0x80, 0xB0, 0x03, 0x79, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO4",  apdu: &[0x80, 0xB0, 0x04, 0x78, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO5",  apdu: &[0x80, 0xB0, 0x05, 0x77, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO6",  apdu: &[0x80, 0xB0, 0x06, 0x76, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO7",  apdu: &[0x80, 0xB0, 0x07, 0x75, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO8",  apdu: &[0x80, 0xB0, 0x08, 0x74, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO9",  apdu: &[0x80, 0xB0, 0x09, 0x73, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO10", apdu: &[0x80, 0xB0, 0x0A, 0x72, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO11", apdu: &[0x80, 0xB0, 0x0B, 0x71, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO12", apdu: &[0x80, 0xB0, 0x0C, 0x70, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO13", apdu: &[0x80, 0xB0, 0x0D, 0x6F, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO14", apdu: &[0x80, 0xB0, 0x0E, 0x6E, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO15", apdu: &[0x80, 0xB0, 0x0F, 0x6D, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO16", apdu: &[0x80, 0xB0, 0x10, 0x6C, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO17", apdu: &[0x80, 0xB0, 0x11, 0x6B, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO18", apdu: &[0x80, 0xB0, 0x12, 0x6A, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO19", apdu: &[0x80, 0xB0, 0x13, 0x69, 0x02, 0x00, 0xFF] },
    ApduPHOTO { key: "APDU_PHOTO20", apdu: &[0x80, 0xB0, 0x14, 0x68, 0x02, 0x00, 0xFF] },
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

fn select_thai_id(card: &Card) -> AppResult<()> {
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

fn transmit_and_read_data(card: &Card, apdu: &[u8]) -> AppResult<Vec<u8>> {
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

fn process_card(card: Card, re: &Regex, gender: &[&str], religion: &[&str], app_handle: &AppHandle) {
    thread::sleep(Duration::from_millis(DELAY_AFTER_CONNECT_MS));

    if let Err(e) = select_thai_id(&card) {
        let _ = app_handle.emit("thai_id_error", format!("เลือกแอปไม่สำเร็จ: {}", e));
        let _ = card.disconnect(Disposition::LeaveCard);
        thread::sleep(Duration::from_millis(DELAY_AFTER_DISCONNECT_MS));
        return;
    }

    let mut output = Vec::new();
    for field in APDU_LIST {
        match transmit_and_read_data(&card, field.apdu) {
            Ok(raw) => {
                let parsed = parse_field(field.key, &raw, gender, religion);
                let clean = re.replace_all(&parsed, " ");
                output.push(format!("{}: {}", field.key, clean));
            }
            Err(e) => output.push(format!("อ่าน {} ไม่ได้: {}", field.key, e)),
        }
    }

    let mut photo_data: Vec<u8> = Vec::new();
    let mut photo_read_error = false;

    println!("[ระบบ] กำลังอ่านรูปภาพ...");
    for (index, photo_field) in APDU_PHOTO.iter().enumerate() {
        match transmit_and_read_data(&card, photo_field.apdu) {
            Ok(mut chunk) => {
                photo_data.append(&mut chunk);
            }
            Err(e) => {
                let error_msg = format!("อ่านรูปภาพส่วนที่ {} ({}) ไม่ได้: {}", index + 1, photo_field.key, e);
                println!("{}", error_msg);
                let _ = app_handle.emit("thai_id_error", error_msg);
                photo_read_error = true;
                break;
            }
        }
    }

    let _ = app_handle.emit("thai_id_data", output.join("\n"));
    println!("Output: {}", output.join("\n"));

    if !photo_read_error && !photo_data.is_empty() {
        println!("[ระบบ] อ่านรูปภาพสำเร็จ (ขนาด: {} bytes), กำลังเข้ารหัส Base64...", photo_data.len());
        let photo_base64 = general_purpose::STANDARD.encode(&photo_data);
        let _ = app_handle.emit("thai_id_photo", &photo_base64);
        println!("[ระบบ] ส่งข้อมูลรูปภาพ Base64 ไปยัง Frontend");
    } else if !photo_read_error && photo_data.is_empty() {
        println!("[ระบบ] ไม่พบข้อมูลรูปภาพ (อ่านสำเร็จแต่ได้ 0 bytes)");
    }

    let _ = card.disconnect(Disposition::LeaveCard);
    thread::sleep(Duration::from_millis(DELAY_AFTER_DISCONNECT_MS));
}

pub fn run_event_loop(app_handle: AppHandle) -> AppResult<()> {
    let ctx = Context::establish(Scope::User)?;
    let gender = ["-", "ชาย", "หญิง"];
    let religion = ["-","พุทธ","อิสลาม","คริสต์","พราหมณ์-ฮินดู","ซิกข์","ยิว","เชน",
                    "โซโรอัสเตอร์","บาไฮ","ไม่นับถือศาสนา","ไม่ทราบ"];
    let re = Regex::new(r"#+")?;

    let readers = ctx.list_readers_owned()?;
    // Wait until a reader is available; emit error events while none found
    loop {
        let readers = ctx.list_readers_owned()?;
        if readers.is_empty() {
            let _ = app_handle.emit("thai_id_error", "ไม่พบเครื่องอ่านบัตร");
            thread::sleep(Duration::from_secs(1));
            continue;
        }
        // found at least one reader
        let reader_name = &readers[0];
        let _ = app_handle.emit("thai_reader_ready", reader_name.to_string_lossy().to_string());
        println!("🖴 ใช้งาน Reader: {}", reader_name.to_string_lossy());

        let mut states = [ReaderState::new(reader_name.as_c_str(), State::UNAWARE)];
    loop {
        match ctx.get_status_change(Some(Duration::from_secs(1)), &mut states) {
            Ok(_) => {}
            Err(PcscError::Timeout) => continue,
            Err(e) => {
                let _ = app_handle.emit("thai_id_error", format!("[ระบบ] เกิดข้อผิดพลาด: {}", e));
                return Err(e.into());
            }
        }

        for state in &mut states {
            let event = state.event_state();
            let current = state.current_state();

            if event.contains(State::PRESENT) && !current.contains(State::PRESENT) {
                println!("\n[ระบบ] ตรวจพบบัตร → เริ่มอ่านข้อมูล...");
                thread::sleep(Duration::from_millis(DELAY_CONNECT_MS));
                let cs = reader_name.as_c_str();
                match ctx.connect(cs, ShareMode::Shared, Protocols::ANY) {
                    Ok(card) => process_card(card, &re, &gender, &religion, &app_handle),
                    Err(e) => {
                        let _ = app_handle.emit("thai_id_error", format!("เชื่อมต่อบัตรไม่สำเร็จ: {}", e));
                    }
                }
            } else if event.contains(State::EMPTY) && current.contains(State::PRESENT) {
                println!("\n[ระบบ] บัตรถูกถอดออกแล้ว");
                app_handle.emit("thai_id_data", "").ok();
                app_handle.emit("thai_id_photo", "").ok();
                app_handle.emit("thai_id_error", "บัตรถูกถอดออกแล้ว").ok();
            }
        }

        states = [ReaderState::new(reader_name.as_c_str(), states[0].event_state())];
        // continue monitoring the same reader in this loop; if reader disappears,
        // the next ctx.get_status_change will eventually report and we can fall back
    }
    }
}

// Return the first available reader name if present (used by frontend to probe reader state)
pub fn get_current_reader() -> Result<Option<String>, String> {
    match Context::establish(Scope::User) {
        Ok(ctx) => {
            match ctx.list_readers_owned() {
                Ok(readers) => {
                    if readers.is_empty() {
                        Ok(None)
                    } else {
                        Ok(Some(readers[0].to_string_lossy().to_string()))
                    }
                }
                Err(e) => Err(format!("PCSC error: {}", e)),
            }
        }
        Err(e) => Err(format!("Context error: {}", e)),
    }
}
