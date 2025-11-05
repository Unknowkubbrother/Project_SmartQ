import { ThaiIDCardData } from "@/interfaces";
import ThaiIDCard from "@/components/ThaiIDCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

function Main({ cardData, photoData, onCancel }: { cardData: ThaiIDCardData | null; photoData: string | null; onCancel: () => void; }) {

  return (
    <main className="w-full flex flex-col justify-between p-4">
      <ThaiIDCard cardData={cardData} photoData={photoData} />
      <div className="w-full h-[300px] lg:h-[500px] lg:max-h-[500px] bg-sky-100 mt-4 grid grid-flow-row grid-cols-2 gap-4 rounded-sm p-4 text-white overflow-auto">
        <Button className="bg-sky-600 rounded-lg p-4 h-[100px] lg:h-[200px]">ช่องบริการทั่วไป</Button>
        <Button className="bg-sky-600 rounded-lg p-4 h-[100px] lg:h-[200px]">ช่องบริการนัดหมาย</Button>
        <Button className="bg-sky-600 rounded-lg p-4 h-[100px] lg:h-[200px]">ช่องบริการฉุกเฉิน</Button>
        <Button className="bg-sky-600 rounded-lg p-4 h-[100px] lg:h-[200px]">ช่องบริการอื่นๆ</Button>
        <Button className="bg-sky-600 rounded-lg p-4 h-[100px] lg:h-[200px]">ติดต่อเจ้าหน้าที่</Button>
      </div>
      <div className="w-full flex justify-around p-4 mt-3" >
        <Button variant="default">เข้ารับบริการ</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">ยกเลิก</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการยกเลิก?</AlertDialogTitle>
              <AlertDialogDescription>
                หากท่านยกเลิก การดำเนินการทั้งหมดจะถูกยกเลิก และท่านจะต้องเริ่มต้นใหม่
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={() => {onCancel(); }}>ยืนยันการยกเลิก</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  )
}

export default Main