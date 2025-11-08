

export default function Home({HOSPITAL_NAME,LOGO}: {HOSPITAL_NAME:string,LOGO:string}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-500 to-cyan-500 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl mx-auto">
        <header className="bg-white/40 backdrop-blur-md rounded-2xl shadow-xl py-7 flex flex-col items-center gap-4">
          <img
            src={LOGO}
            alt="SmartQ Logo"
            width={110}
            height={110}
            className="rounded-full ring-4 ring-white shadow-md"
            loading="lazy"
          />
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo-700">
              จุดรับบัตรคิว
            </h1>
            <h2 className="text-sm sm:text-lg text-gray-600 mt-2">
              {HOSPITAL_NAME}
            </h2>
          </div>
          <div className="text-center">
            <p className="text-sm opacity-90">สถานะ</p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20">
              <span className="w-3 h-3 rounded-full bg-green-400 block" />
              <span className="text-sm">พร้อมให้บริการ</span>
            </div>
          </div>
        </header>

        <section className="mt-6 bg-white/50 backdrop-blur-sm rounded-2xl shadow-md p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-gray-700 text-lg">
              กรุณาเสียบบัตรประชาชนของท่านที่เครื่องอ่านบัตร
            </p>

            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li>• เสียบบัตรตามรูปแบบบนเครื่องอ่าน</li>
              <li>• รอรับการยืนยันจากระบบ</li>
              <li>• รับเลขคิวและรอเรียกตามลำดับ</li>
            </ul>

          </div>

          <div className="flex-1 flex flex-col items-center">
            <div className="bg-gradient-to-b from-white to-gray-50 rounded-xl p-4 shadow-inner flex flex-col items-center">
              <img
                src="./Example_Queue.webp"
                alt="ID Card Scanner"
                width={170}
                height={170}
                className="w-[150px] h-[150px] object-contain rounded-lg animate-pulse"
                loading="lazy"
              />
              <span className="mt-3 text-sm text-gray-500">ตัวอย่างการเสียบบัตร</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
