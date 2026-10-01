import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  MonitorCog,
  ShieldCheck,
  Users,
} from "lucide-react";


export default function Home() {
  return (
    <main className="min-h-screen bg-[#08111f] text-white">

      {/* Navbar */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div className="flex items-center gap-3">

            <div className="
              flex h-12 w-12 items-center justify-center
              rounded-xl bg-blue-600
              font-bold
            ">
              BTI
            </div>

            <div>
              <h1 className="font-bold">
                BTI Operations
              </h1>

              <p className="text-xs text-slate-400">
                CV Bengkel Teknologi Indonesia
              </p>
            </div>

          </div>


          <Link
            href="/login"
            className="
            flex items-center gap-2
            rounded-xl
            bg-blue-600
            px-5 py-3
            text-sm font-semibold
            hover:bg-blue-700
            "
          >

            Login Sistem
            <ArrowRight size={16}/>

          </Link>


        </div>
      </header>




      {/* Hero */}

      <section className="
        mx-auto grid
        max-w-7xl
        gap-12
        px-6 py-24
        lg:grid-cols-2
      ">


        <div className="flex flex-col justify-center">


          <div className="
          mb-6 flex w-fit items-center gap-2
          rounded-full
          bg-blue-500/10
          px-4 py-2
          text-sm text-blue-300
          ">

            <ShieldCheck size={16}/>

            Sistem Operasional Internal

          </div>



          <h2 className="
          text-5xl
          font-extrabold
          leading-tight
          ">

            Digitalisasi
            <br/>

            <span className="text-blue-400">
              Operasional BTI
            </span>

          </h2>



          <p className="
          mt-6
          max-w-xl
          text-lg
          text-slate-300
          ">

            Platform internal CV Bengkel Teknologi Indonesia
            untuk mengelola presensi, penugasan teknisi,
            laporan operasional, dan aktivitas perusahaan
            secara terintegrasi.

          </p>



          <div className="mt-8">

            <Link
              href="/login"
              className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-blue-600
              px-6 py-3
              font-semibold
              hover:bg-blue-700
              "
            >

              Masuk Dashboard

              <ArrowRight size={18}/>

            </Link>

          </div>


        </div>





        {/* Preview */}

        <div className="
        flex items-center justify-center
        ">


          <div className="
          w-full
          max-w-lg
          rounded-3xl
          border border-white/10
          bg-white/5
          p-8
          backdrop-blur
          ">


            <div className="
            mb-8
            flex items-center gap-4
            ">


              <div className="
              rounded-2xl
              bg-blue-500/20
              p-4
              text-blue-400
              ">

                <MonitorCog size={36}/>

              </div>


              <div>

                <h3 className="text-xl font-bold">
                  BTI Operations
                </h3>

                <p className="text-sm text-slate-400">
                  Management System
                </p>

              </div>


            </div>



            <Feature
              icon={<Users/>}
              title="Manajemen Teknisi"
              desc="Kelola akun dan data teknisi."
            />


            <Feature
              icon={<ClipboardCheck/>}
              title="Presensi Digital"
              desc="Monitoring masuk dan pulang."
            />


            <Feature
              icon={<Building2/>}
              title="Operasional"
              desc="Laporan perusahaan terstruktur."
            />



          </div>


        </div>


      </section>





      <footer className="
      border-t
      border-white/10
      py-8
      text-center
      text-sm
      text-slate-400
      ">

        © {new Date().getFullYear()} CV Bengkel Teknologi Indonesia

      </footer>


    </main>
  );
}





function Feature({
  icon,
  title,
  desc
}:{
  icon:React.ReactNode;
  title:string;
  desc:string;
}){

return (

<div className="
mb-4
flex
items-center
gap-4
rounded-xl
border
border-white/10
bg-white/5
p-4
">


<div className="text-blue-400">

{icon}

</div>


<div>

<h4 className="font-semibold">
{title}
</h4>


<p className="text-sm text-slate-400">
{desc}
</p>


</div>


</div>

)

}