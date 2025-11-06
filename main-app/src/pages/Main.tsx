import { ThaiIDCardData } from "@/interfaces";
import ThaiIDCard from "@/components/ThaiIDCard";
import { Button } from "@/components/ui/button";
import axios from "axios";
import Swal from "sweetalert2";

function Main({ cardData, photoData, onCancel, backendUrl, username }: { cardData: ThaiIDCardData | null; photoData: string | null; onCancel: () => void; backendUrl?: string | null, username?: string }) {
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
        const endpointBase = (backendUrl && backendUrl.length > 0) ? backendUrl.replace(/\/$/, '') : 'http://localhost:8000';
        const existsPerson = await axios.get(endpointBase + `/api/check_exist_person/${cardData?.CID}`);

        if (!existsPerson.data.exists) {
          Swal.fire({
            title: "ไม่พบข้อมูลบุคคล",
            text: "ไม่พบข้อมูลบุคคลในระบบ กรุณาติดต่อเจ้าหน้าที่.",
            icon: "error"
          });
          return;
        }

        const insert_visit = await axios.post(endpointBase + '/api/insert_visit', { username: username || 'adm', cid: cardData?.CID });

        if (insert_visit.status !== 200) {
          Swal.fire({
            title: "เกิดข้อผิดพลาด!",
            text: "ไม่สามารถบันทึกข้อมูลการเข้ารับบริการได้ กรุณาลองใหม่อีกครั้ง.",
            icon: "error"
          });
          return;
        }

        await axios.post(endpointBase + '/api/enqueue', { FULLNAME_TH: cardData?.FULLNAME_TH })
          .then((_: any) => {
            Swal.fire({
              title: "สำเร็จ!",
              text: "คุณได้ยืนยันการเข้ารับบัตรคิวเรียบร้อยแล้ว.",
              icon: "success",
              timer: 2000,
              timerProgressBar: true,
              showConfirmButton: false,
            }).then(() => {
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
            });
          })
          .catch((error: any) => {
            Swal.fire({
              title: "เกิดข้อผิดพลาด!",
              text: "ไม่สามารถยืนยันการเข้ารับบัตรคิวได้ กรุณาลองใหม่อีกครั้ง.",
              icon: "error"
            });
            console.error("Error submitting service:", error);
          });
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
    <main className="w-full flex flex-col justify-between p-4 lg:gap-7">
      <header className="w-full justify-center items-center flex flex-col p-4">
        <img src="./logo.png" alt="" width={100} height={100} />
        <h1 className="text-4xl">หน้ารับบัตรคิว</h1>
        <h2 className="text-2xl mt-5">โรงพยาบาลส่งเสริมสุขภาพตำบลคลองบุหรี่</h2>
      </header>

      <div className="w-full h-5"></div>
      <hr className="my-4 border-gray-300 w-full" />
      <ThaiIDCard cardData={cardData} photoData={photoData} />
      <div className="w-full flex justify-around p-4 mt-3 gap-3" >
        <Button variant="default" onClick={submitServiceSelection} size='lg' className="w-1/2 h-20">รับบัตรคิว</Button>
        <Button variant="destructive" onClick={() => { handleOnCancel(); }} size='lg' className="w-1/2 h-20">ยกเลิก</Button>
      </div>
    </main>
  )
}

export default Main