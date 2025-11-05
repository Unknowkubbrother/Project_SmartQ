export default function Home() {
  return (
    <main className="w-full h-full">
        <header className="w-full justify-center items-center flex flex-col">
            <img src="./logo.png" alt="" width={100} height={100} />
            <h1 className="text-2xl">จุดบริการด้วยตนเอง</h1>
            <h2 className="text-[12px]">โรงพยาบาลส่งเสริมสุขภาพตำบลคลองบุหรี่</h2>
        </header>

        <div className="w-full h-5"></div>
        <hr className="my-4 border-gray-300 w-full" />

        <section className="w-full h-[calc(100vh-300px)] flex flex-col justify-center items-center gap-4">
            <p className="text-center px-4">กรุณาเสียบบัตรประชาชนไทยของท่าน</p>
            <img src="./thai_id_card.png" alt="ID Card Scanner" width={300} height={300} />
        </section>
    </main>
  )
}
