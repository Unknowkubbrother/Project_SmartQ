import { SmartQPayload } from "@/interfaces";

function PlaceholderPhoto() {
  return (
    <div className="w-20 h-28 lg:w-24 lg:h-32 bg-slate-100 border border-slate-200 flex items-center justify-center rounded-md">
      <svg className="w-8 h-8 lg:w-10 lg:h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      </svg>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] lg:text-[17px] text-sky-400 font-medium">{label}</span>
      <span className="text-xs lg:text-[15px] text-slate-800 lg:mt-2">{value ?? "—"}</span>
    </div>
  );
}

const CIDFormat = (CID: string | null) => {
  return CID?.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5') || "";
}

function ThaiIDCard({
  cardData,
  photoData
}: {
  cardData: SmartQPayload | null;
  photoData?: string | null;
}) {

  return (
    <main className="w-full mx-auto p-2">
      <section className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl shadow-md overflow-hidden relative">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">ข้อมูลส่วนตัว</h3>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-sky-500 bg-sky-50 px-2 py-0.5 rounded-full">บัตรประชาชน</span>
          </div>
        </div>

        <div className="px-4 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-2 space-y-2">
            <div className="flex gap-4 flex-wrap">
              <Field label="หมายเลขบัตรประชาชน" value={CIDFormat(cardData?.pid || "")} />
              <Field label="ชื่อ-นามสกุล" value={cardData?.thaiIDCardData.FULLNAME_TH} />
            </div>


            <div className="flex gap-4 flex-wrap">
              <Field label="วันเดือนปีเกิด" value={cardData?.thaiIDCardData.BIRTH} />
              <Field label="เพศ" value={cardData?.thaiIDCardData.GENDER} />
              <Field label="ศาสนา" value={cardData?.thaiIDCardData.RELIGION} />
            </div>
            
            <div className="w-full">
              <Field label="ที่อยู่" value={cardData?.thaiIDCardData.ADDRESS} />
            </div>

            <div className="flex gap-4 flex-wrap">
              <Field label="วันที่ออกบัตร" value={(cardData?.thaiIDCardData.ISSUE)} />
              <Field label="วันที่บัตรหมดอายุ" value={(cardData?.thaiIDCardData.EXPIRE)} />
            </div>

            <div className="flex gap-4 flex-wrap">
              <Field label="สิทธิการรักษาหลัก" value={(cardData?.mainInscl)} />
              <Field label="สิทธิการรักษาย่อย" value={(cardData?.subInscl)} />
            </div>

          </div>

          <div className="absolute top-16 right-8 md:relative md:top-0 md:right-0 flex flex-col items-center">
              <div className="relative">
                {photoData ? (
                  <img
                    src={`data:image/jpeg;base64,${photoData}`}
                    alt="ID Card Photo"
                    className="w-20 h-28 lg:w-24 lg:h-32 object-cover rounded-md border border-slate-200 shadow-sm"
                  />
                ) : (
                  <PlaceholderPhoto />
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">รูปถ่าย</div>
            </div>
          <div />
        </div>
      </section>
    </main>
  );
}

export default ThaiIDCard;