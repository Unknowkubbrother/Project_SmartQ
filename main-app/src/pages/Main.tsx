import { ThaiIDCardData } from "@/interfaces";
import ThaiIDCard from "@/components/ThaiIDCard";
import { Button } from "@/components/ui/button";


function Main({ cardData, photoData }: { cardData: ThaiIDCardData | null; photoData: string | null; }) {
  return (
    <main className="w-full flex flex-col justify-between p-4">
        <ThaiIDCard cardData={cardData} photoData={photoData} />
        <div className="w-full h-[300px] bg-sky-400 mt-4 grid grid-flow-row grid-cols-2 gap-4 rounded-sm p-4 text-white overflow-auto">
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 1</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 2</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 3</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 4</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 5</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 6</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 7</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 8</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 1</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 2</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 3</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 4</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 5</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 6</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 7</Button>
            <Button className="bg-sky-600 rounded-lg p-4 h-[100px]">Content 8</Button>

        </div>
        <div className="fixed bottom-10 w-full flex justify-around p-4" >
            <Button variant="default">เข้ารับบริการ</Button>
            <Button variant="destructive">ยกเลิก</Button>
        </div>
    </main>
  )
}

export default Main