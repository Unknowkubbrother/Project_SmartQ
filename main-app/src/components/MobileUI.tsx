import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { Button } from "@/components/ui/button";

export default function MobileUI({ mobile, setMobile , setMobileUI , submitServiceSelection }: { mobile: string, setMobile: (mobile: string) => void, setMobileUI: (mobileUI: boolean) => void, submitServiceSelection: () => void }) {
    return (
        <main className="fixed inset-0 z-50 flex items-center justify-center ">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
            <section className="relative z-10 flex justify-center items-center flex-col max-w-md md:max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 p-6">
                <h2 className="text-lg font-bold mb-4 text-center">กรุณาใส่เบอร์โทรศัพท์</h2>
                <InputOTP
                    maxLength={10}
                    value={mobile}
                    onChange={(mobile) => setMobile(mobile)}
                    className="w-full flex justify-center items-center"
                    required
                >
                    <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                        <InputOTPSlot index={6} />
                        <InputOTPSlot index={7} />
                        <InputOTPSlot index={8} />
                        <InputOTPSlot index={9} />
                    </InputOTPGroup>
                </InputOTP>
                <div className="flex gap-4 mt-6">
                    <Button onClick={submitServiceSelection}>ยืนยัน</Button>
                    <Button variant='destructive' onClick={() => {
                        setMobileUI(false);
                        setMobile("");
                    }}>ยกเลิก</Button>
                </div>
            </section>
        </main>
    )
}
