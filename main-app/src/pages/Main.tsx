import { useState } from "react";
import { SmartQPayload } from "@/interfaces";
import ThaiIDCard from "@/components/ThaiIDCard";
import { Button } from "@/components/ui/button";
import axios from "axios";
import Swal from "sweetalert2";
import ClaimUI from "@/components/ClaimUI";
import MobileUI from "@/components/MobileUI";

function Main({ cardData, photoData, onCancel, backendUrl, username,HOSPITAL_NAME, LOGO }: { cardData: SmartQPayload | null; photoData: string | null; onCancel: () => void; backendUrl?: string | null, username?: string, HOSPITAL_NAME?: string, LOGO?: string }) {
  const [mobileUI, setMobileUI] = useState<boolean>(false)
  const [mobile, setMobile] = useState<string>("")
  const [claim, setClaim] = useState<boolean>(false);

  const submitServiceSelection = () => {
    Swal.fire({
      title: "คุณต้องการยืนยันการเข้ารับบัตรคิวใช่หรือไม่?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "ใช่, ยืนยันการเข้ารับบัตรคิว",
      cancelButtonText: "ยกเลิก"
    }).then(async (result: any) => {
      if (result.isConfirmed) {
        if (mobile.length !== 10) {
          Swal.fire({
            title: "เบอร์โทรศัพท์ไม่ถูกต้อง",
            text: "กรุณาใส่เบอร์โทรศัพท์ให้ครบ 10 หลัก.",
            icon: "error"
          });
          return;
        }

        if (!/^\d+$/.test(mobile)) {
          Swal.fire({
            title: "เบอร์โทรศัพท์ต้องเป็นตัวเลขเท่านั้น",
            text: "กรุณาใส่เบอร์โทรศัพท์เป็นตัวเลขเท่านั้น.",
            icon: "error"
          });
          return;
        }

        if (mobile[0] !== '0') {
          Swal.fire({
            title: "เบอร์โทรศัพท์ไม่ถูกต้อง",
            text: "เบอร์โทรศัพท์ต้องขึ้นต้นด้วยเลข 0.",
            icon: "error"
          });
          return;
        }

        setMobileUI(false);

        const existsPerson = await axios.get(backendUrl + `/api/jhcis/check_exist_person/${cardData?.pid}`);

        if (!existsPerson.data.exists) {
          Swal.fire({
            title: "ไม่พบข้อมูลบุคคล",
            text: "ไม่พบข้อมูลบุคคลในระบบ กรุณาติดต่อเจ้าหน้าที่.",
            icon: "error"
          });
          return;
        }

        const claimData = await axios.post('http://localhost:8189/api/nhso-service/confirm-save' , {
          pid: cardData?.pid,
          claimType: cardData?.claimTypes?.[0]?.claimType,
          mobile: mobile,
          correlationId: cardData?.correlationId
        });

        if (claimData.status !== 200) {
          Swal.fire({
            title: "เกิดข้อผิดพลาด!",
            text: "ไม่สามารถขอ New Authen สิทธิการรักษาได้ กรุณาลองใหม่อีกครั้ง.",
            icon: "error"
          });
          return;
        }

        const rawResponse: any = claimData.data ?? {};
        const payload: any = rawResponse.data ?? rawResponse.result ?? rawResponse.claim ?? rawResponse;

        const claimTypeFromServer = payload.claimType ?? rawResponse.claimType ?? undefined;
        const claimCodeFromServer = payload.claimCode ?? rawResponse.claimCode ?? undefined;
        const created = payload.createdDate ?? rawResponse.createdDate ?? rawResponse.data?.createdDate as string | undefined;

        let datetime_claim = created || "";

        if (created) {
          const d = new Date(created);
          if (!isNaN(d.getTime())) {
            const Y = d.getFullYear();
            const M = d.getMonth() + 1;
            const D = d.getDate();
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            const ss = String(d.getSeconds()).padStart(2, "0");
            datetime_claim = `${Y}-${M}-${D} ${hh}:${mm}:${ss}`;
          }
        }

        const insert_visit = await axios.post(backendUrl + "/api/jhcis/insert_visit", {
          username: username || "adm",
          pid: cardData?.pid,
          claimType: claimTypeFromServer || cardData?.claimTypes?.[0]?.claimType,
          claimCode: claimCodeFromServer,
          datetime_claim,
          mainInscl: cardData?.mainInscl,
          subInscl: cardData?.subInscl,
        });

        if (insert_visit.status !== 200) {
          Swal.fire({
            title: "เกิดข้อผิดพลาด!",
            text: "ไม่สามารถบันทึกข้อมูลการเข้ารับบริการได้ กรุณาลองใหม่อีกครั้ง.",
            icon: "error"
          });
          return;
        }

        const queue_inspect = await axios.post(backendUrl + '/api/queue/inspect/enqueue', { FULLNAME_TH: cardData?.thaiIDCardData.FULLNAME_TH });

        if (queue_inspect.status !== 200) {
          Swal.fire({
            title: "เกิดข้อผิดพลาด!",
            text: "ไม่สามารถยืนยันการเข้ารับบัตรคิวได้ กรุณาลองใหม่อีกครั้ง.",
            icon: "error"
          });
          return;
        }

        
        const returnedItem: any = queue_inspect.data?.item || queue_inspect.data?.data || queue_inspect.data || {};
        const assignedNumber = returnedItem.Q_number ?? returnedItem.Q_number ?? returnedItem?.Q_Number ?? null;

        
        const title = assignedNumber ? `สำเร็จ! คิวของคุณคือ ${assignedNumber}` : 'สำเร็จ!';
        const html = assignedNumber
          ? `<div style="text-align:center"><h2 style="font-size:48px;margin:0;">${assignedNumber}</h2><div style="margin-top:8px;">${cardData?.thaiIDCardData.FULLNAME_TH || ''}</div><div style="margin-top:4px; font-size:12px; color:#666;">บริการ: รับบัตรคิว</div></div>`
          : 'คุณได้ยืนยันการเข้ารับบัตรคิวเรียบร้อยแล้ว.';

        const res = await Swal.fire({
          title,
          html,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: 'พิมพ์ใบคิว',
          cancelButtonText: 'ไม่พิมพ์',
          width: 420,
        });

        if (res.isConfirmed && assignedNumber) {
          
          try {
            const w = window.open('', '_blank', 'width=400,height=600');
            if (w) {
              const now = new Date();
              const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><title>ใบคิว</title><style>body{font-family: Arial, Helvetica, sans-serif; text-align:center; padding:20px;} .num{font-size:72px; font-weight:700; margin:20px 0;} .meta{font-size:14px; color:#444}</style></head><body>` +
                `<div><img src="${LOGO || ''}" alt="logo" style="width:80px;height:80px;border-radius:50%;object-fit:cover"/></div>` +
                `<div class="meta">${HOSPITAL_NAME || ''}</div>` +
                `<div class="num">${assignedNumber}</div>` +
                `<div class="meta">ชื่อ: ${cardData?.thaiIDCardData.FULLNAME_TH || ''}</div>` +
                `<div class="meta">บริการ: รับบัตรคิว</div>` +
                `<div class="meta" style="margin-top:12px; font-size:12px;">${now.toLocaleString()}</div>` +
                `</body></html>`;
              w.document.write(htmlDoc);
              w.document.close();
              
              setTimeout(() => {
                try { w.print(); } catch (e) { console.warn('print failed', e); }
              }, 300);
            }
          } catch (e) {
            console.error('print error', e);
          }
        }

        
        Swal.fire({
          title: 'กลับสู่หน้าหลัก',
          timer: 1500,
          timerProgressBar: true,
          showConfirmButton: false,
        }).then(() => onCancel());
      }
    });
  }

  const handleOnCancel = () => {
    Swal.fire({
      title: "คุณแน่ใจหรือไม่ว่าต้องการยกเลิก?",
      text: "ข้อมูลที่กรอกจะไม่ถูกบันทึก",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "ใช่, ยกเลิก",
      cancelButtonText: "ไม่, กลับไป"
    }).then((result: any) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: "กลับสู่หน้าหลัก",
          timer: 3000,
          timerProgressBar: true,
          didOpen: () => {
            Swal.showLoading();
          }
        }).then(() => {
          onCancel();
        });
      }
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center p-6 lg:p-12">
      {/* Header */}
      <header className="w-full max-w-4xl">
        <div className="rounded-xl overflow-hidden shadow-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-4 flex flex-col lg:flex-row items-center gap-4 p-6">
          <img src={LOGO} alt="logo" className="w-20 h-20 rounded-full bg-white/20 p-1" />
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-2xl lg:text-4xl font-semibold drop-shadow">หน้ารับบัตรคิว</h1>
            <p className="mt-1 text-sm lg:text-base opacity-90">{HOSPITAL_NAME}</p>
          </div>
          <div className="text-center">
            <p className="text-sm opacity-90">สถานะ</p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20">
              <span className="w-3 h-3 rounded-full bg-green-400 block" />
              <span className="text-sm">พร้อมให้บริการ</span>
            </div>
          </div>
        </div>
      </header>

      
      <section className="w-full max-w-4xl mt-2">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl py-1 px-4 lg:p-8 divide-y">
          
          <div className="pb-4">
            <div className="w-full flex flex-col  gap-6">
              
              <div className="w-full bg-white rounded-xl shadow-inner">
                <ThaiIDCard cardData={cardData} photoData={photoData}/>
              </div>

              <div className="w-full flex flex-col gap-4">

                <div className="w-full flex flex-col sm:flex-row gap-3 mt-auto lg:justify-center lg:items-center">
                  <Button
                    variant="default"
                    onClick={() => setMobileUI(true)}
                    size="lg"
                    className=" bg-emerald-500 hover:bg-emerald-600 border-0 shadow-md lg:h-15 lg:w-48"
                  >
                    รับบัตรคิว
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={handleOnCancel}
                    size="lg"
                    className="lg:h-15 lg:w-48"
                  >
                    ยกเลิก
                  </Button>
                </div>

                <div className="text-xs text-slate-500 mt-2">
                  หมายเหตุ: กรุณตรวจสอบข้อมูลก่อนยืนยันการรับบริการ
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      
      {!claim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl">
            <ClaimUI data={cardData as SmartQPayload} handleOnCancel={handleOnCancel} setClaim={setClaim} />
          </div>
        </div>
      )}

      {mobileUI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl">
            <MobileUI mobile={mobile} setMobile={setMobile} setMobileUI={setMobileUI} submitServiceSelection={submitServiceSelection} />
          </div>
        </div>

      )}

    </main>
  )
}

export default Main