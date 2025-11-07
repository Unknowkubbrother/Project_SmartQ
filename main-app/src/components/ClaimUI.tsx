import { SmartQPayload } from "@/interfaces"
import { Button } from "@/components/ui/button"
import { useMemo } from "react"

export default function ClaimUI({ data , handleOnCancel , setClaim }: { data: SmartQPayload , handleOnCancel: () => void, setClaim: (claim: boolean) => void }) {
    const fullName = data?.thaiIDCardData?.FULLNAME_TH ?? "-"
    const pid = data?.pid ?? "-"
    const issue = data?.thaiIDCardData?.ISSUE ?? "-"
    const expire = data?.thaiIDCardData?.EXPIRE ?? "-"
    const mainIns = data?.mainInscl ?? "-"
    const subIns = data?.subInscl ?? "-"
    const hospMain = data?.hospMain?.hname ?? "-"
    const hospSub = data?.hospSub?.hname ?? "-"
    const hospMainOp = data?.hospMainOp?.hname ?? "-"

    const initials = useMemo(() => {
        return fullName
            .split(" ")
            .map((s) => s[0] ?? "")
            .slice(0, 2)
            .join("")
            .toUpperCase()
    }, [fullName])

    return (
        <main className="fixed inset-0 z-50 flex items-center justify-center ">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
            <section className="relative z-10 w-11/12 max-w-md md:max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 scale-90 lg:scale-100">
                <header className="flex items-center gap-3 md:gap-4 p-4 md:p-5 bg-linear-to-r from-sky-600 to-cyan-500 text-white">
                    <div className="flex items-center justify-center h-14 w-14 md:h-20 md:w-20 rounded-full bg-white/20 font-semibold text-lg md:text-xl">
                        {initials}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-md md:text-lg font-bold">ข้อมูลสิทธิ์การรักษา</h1>
                        <p className="text-xs md:text-sm opacity-90">ตรวจสอบข้อมูลผู้ป่วยก่อนยืนยันการรับบริการ</p>
                    </div>
                </header>

                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-3">
                        <InfoRow label="หมายเลขบัตรประชาชน" value={pid} />
                        <InfoRow label="ชื่อ-นามสกุล" value={fullName} />
                        <InfoRow label="วันที่ออกบัตร" value={issue} />
                        <InfoRow label="วันที่บัตรหมดอายุ" value={expire} />
                    </div>

                    <div className="space-y-3">
                        <InfoRow label="สิทธิการรักษาหลัก" value={mainIns} />
                        <InfoRow label="สิทธิการรักษาย่อย" value={subIns} />
                        <InfoRow label="รพ.หลัก" value={hospMain} />
                        <InfoRow label="รพ.รอง / รพ.ประจำ" value={`${hospSub} / ${hospMainOp}`} />
                    </div>
                </div>

                <footer className="flex flex-col sm:flex-row gap-2 md:gap-3 p-4 md:p-5 border-t">
                    <Button className="flex-1 py-2 text-sm md:py-3 md:text-base bg-emerald-500 hover:bg-emerald-600 border-0 shadow-md" variant="default" size="lg"
                        onClick={() => setClaim(true)}
                    >
                        ยืนยันตรวจรักษา
                    </Button>
                    <Button className="flex-1 py-2 text-sm md:py-3 md:text-base" variant="destructive" size="lg"
                        onClick={handleOnCancel}
                    >
                        ยกเลิก
                    </Button>
                </footer>
            </section>
        </main>
    )
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg p-2 md:p-3 bg-gray-50 border">
            <div className="text-xs md:text-sm text-gray-500">{label}</div>
            <div className="mt-1 font-medium text-gray-800 text-sm md:text-base">{value}</div>
        </div>
    )
}
