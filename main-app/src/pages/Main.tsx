import { useState } from "react";
import { ThaiIDCardData } from "@/interfaces";
import ThaiIDCard from "@/components/ThaiIDCard";
import { Button } from "@/components/ui/button";
import axios from "axios";
import Swal from "sweetalert2";


function Main({ cardData, photoData, onCancel }: { cardData: ThaiIDCardData | null; photoData: string | null; onCancel: () => void; }) {
  const serviceTypes: { [key: string]: string } = {
    "general": "ช่องบริการทั่วไป",
    "appointment": "ช่องบริการนัดหมาย",
    "emergency": "ช่องบริการฉุกเฉิน",
    "other": "ช่องบริการอื่นๆ",
    "contact_staff": "ติดต่อเจ้าหน้าที่"
  };
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const submitServiceSelection = () => {
    if (!selectedService) {
      console.log("No service selected");
      return;
    }

    Swal.fire({
      title: "คุณต้องการยืนยันการเข้ารับบริการใช่หรือไม่?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "ใช่, ยืนยันการเข้ารับบริการ",
      cancelButtonText: "ยกเลิก"
    }).then((result) => {
      if (result.isConfirmed) {
        axios.post("http://localhost:8000/enqueue", { FULLNAME_TH: cardData?.FULLNAME_TH, service: selectedService })
          .then(_ => {
            Swal.fire({
              title: "สำเร็จ!",
              text: "คุณได้ยืนยันการเข้ารับบริการเรียบร้อยแล้ว.",
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
                setSelectedService(null);
                onCancel();
              });
            });
          })
          .catch(error => {
            Swal.fire({
              title: "เกิดข้อผิดพลาด!",
              text: "ไม่สามารถยืนยันการเข้ารับบริการได้ กรุณาลองใหม่อีกครั้ง.",
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
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: "กลับสู่หน้าหลัก",
          timer: 3000,
          timerProgressBar: true,
          didOpen: () => {
            Swal.showLoading();
          }
        }).then(() => {
          setSelectedService(null);
          onCancel();
        });
      }
    });
  }

  return (
    <main className="w-full flex flex-col justify-between p-4">
      <ThaiIDCard cardData={cardData} photoData={photoData} />
      <div className="w-full h-[300px] lg:h-[500px] lg:max-h-[500px] bg-sky-100 mt-4 grid grid-flow-row grid-cols-2 gap-4 rounded-sm p-4 text-white overflow-auto">
        {Object.entries(serviceTypes).map(([key, label]) => (
          <Button
            className={`bg-sky-600 rounded-lg p-4 h-[100px] lg:h-[200px] ${selectedService === key ? "ring-4 bg-green-400" : ""}`}
            key={key}
            onClick={() => {
              setSelectedService(key);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="w-full flex justify-around p-4 mt-3" >
        <Button variant="default" onClick={submitServiceSelection}>เข้ารับบริการ</Button>
        <Button variant="destructive" onClick={() => { handleOnCancel(); }}>ยืนยันการยกเลิก</Button>
      </div>
    </main>
  )
}

export default Main