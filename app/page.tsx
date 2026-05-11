"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BadgeDollarSign,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  Gauge,
  Globe2,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type CarResult = {
  title: string
  year: string | number
  mileage: string
  price: string
  images?: string[]
  customs?: string | number
  carPriceKzt: number
  logistics: number
  util: number
  firstReg: number
  excise: number
  broker: number
  total: number
  selectedEngine: string
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}

const formatKzt = (value: number) =>
  `${new Intl.NumberFormat("ru-RU").format(value)} ₸`

const formatKrw = (value: number) =>
  `${new Intl.NumberFormat("ko-KR").format(value)} ₩`

export default function Home() {
  const [url, setUrl] = useState("")
  const [engine, setEngine] = useState("2.0")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeImage, setActiveImage] = useState(0)
  const [car, setCar] = useState<CarResult | null>(null)

  const handleCalculate = async () => {
    setError("")
    if (!url.trim().includes("encar.com")) {
      setError("Введите корректную ссылку Encar.")
      return
    }

    try {
      setLoading(true)
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, engine }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Ошибка расчета")

      const krwPrice = Number(String(data.price || "").replace(/[^\d]/g, "")) || 0
      const carPriceKzt = Math.round(krwPrice * 0.36)
      const logistics = 2500 * 460
      const engineVolume = Number(engine)
      const util =
        engineVolume <= 1 ? 324000 : engineVolume <= 2 ? 757000 : engineVolume <= 3 ? 1080000 : 2490000

      const age = new Date().getFullYear() - Number(data.year || new Date().getFullYear())
      const firstReg = age <= 2 ? 1081 : 2162500
      const excise = engineVolume >= 3 ? engineVolume * 100000 : 0
      const broker = 500000
      const customs = Number(String(data.customs || "").replace(/[^\d]/g, "")) || 0
      const total = carPriceKzt + logistics + customs + util + firstReg + excise + broker

      setCar({
        title: data.title || "Автомобиль из Кореи",
        year: data.year || "Unknown",
        mileage: data.mileage || "Unknown",
        price: formatKrw(krwPrice),
        images: Array.isArray(data.images) ? data.images : [],
        customs,
        carPriceKzt,
        logistics,
        util,
        firstReg,
        excise,
        broker,
        total,
        selectedEngine: `${engine} л`,
      })
      setActiveImage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить расчет")
    } finally {
      setLoading(false)
    }
  }

  const status = useMemo(() => {
    if (!car) return null
    if (car.total < 17500000) return { label: "Выгодно", className: "text-emerald-300 bg-emerald-500/10 border-emerald-400/30" }
    if (car.total < 25500000) return { label: "Средняя цена", className: "text-yellow-300 bg-yellow-500/10 border-yellow-400/30" }
    return { label: "Дорого", className: "text-rose-300 bg-rose-500/10 border-rose-400/30" }
  }, [car])

  const images = car?.images?.length ? car.images : ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1200&auto=format&fit=crop"]

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0A0A0A] text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#F5C542]/10 blur-[120px]" />
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 md:px-8 lg:px-12">
        <motion.section initial="hidden" animate="show" variants={fadeUp} transition={{ duration: 0.6 }} className="grid items-center gap-10 py-10 md:grid-cols-2 md:py-16">
          <div className="space-y-6">
            <Badge className="bg-white/5 text-zinc-200">
              <Sparkles className="mr-2 h-3.5 w-3.5 text-[#F5C542]" /> Premium Auto Import Platform
            </Badge>
            <h1 className="text-balance text-4xl font-semibold leading-tight md:text-6xl">
              Импорт авто из Кореи в Казахстан
            </h1>
            <p className="max-w-xl text-zinc-300 md:text-lg">
              Моментальный расчет стоимости авто с таможней, логистикой и всеми расходами.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" })}>
                Рассчитать стоимость <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="ghost">Telegram</Button>
            </div>
          </div>
          <Card className="relative overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1542282088-fe8426682b8f?q=80&w=1600&auto=format&fit=crop"
              alt="Premium import car"
              className="h-[340px] w-full object-cover md:h-[430px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 flex gap-2">
              <Badge className="bg-black/40 text-zinc-100">Прозрачный расчет</Badge>
              <Badge className="bg-black/40 text-zinc-100">До 2 минут</Badge>
            </div>
          </Card>
        </motion.section>

        <section id="calculator" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <Card>
              <CardContent className="space-y-4 p-6 md:p-8">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold md:text-3xl">Калькулятор стоимости</h2>
                  <Badge className="bg-[#F5C542]/10 text-[#F5C542]">Live Estimate</Badge>
                </div>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Вставьте ссылку Encar"
                />
                <Select value={engine} onChange={(e) => setEngine(e.target.value)}>
                  {["1.0", "1.3", "1.5", "1.6", "2.0", "2.5", "3.0", "3.5", "4.0", "5.0"].map((item) => (
                    <option key={item} value={item}>{item} л</option>
                  ))}
                </Select>
                {error && <p className="text-sm text-rose-300">{error}</p>}
                <Button size="lg" className="w-full" onClick={handleCalculate} disabled={loading}>
                  {loading ? "Считаем..." : "Рассчитать"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.aside initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <Card className="sticky top-6">
              <CardContent className="space-y-4 p-6">
                <p className="text-sm uppercase tracking-wide text-zinc-400">Сравнение рынка</p>
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between"><span>Средний импорт</span><span>18.5M ₸</span></div>
                  <div className="flex items-center justify-between"><span>Премиум сегмент</span><span>32M ₸</span></div>
                  <div className="flex items-center justify-between"><span>Ваш расчет</span><span className="text-white">{car ? formatKzt(car.total) : "—"}</span></div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-4">
                  <p className="text-xs text-zinc-400">Итоговый статус</p>
                  <div className="mt-2">
                    {status ? <Badge className={status.className}>{status.label}</Badge> : <Badge className="text-zinc-300">Ожидается расчет</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.aside>
        </section>

        <section className="mt-8">
          {!car && loading ? (
            <Card>
              <CardContent className="space-y-4 p-6 md:p-8">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-64 w-full" />
                <div className="grid gap-3 md:grid-cols-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {car && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="space-y-6 p-6 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-2xl font-semibold md:text-3xl">{car.title}</h3>
                    {status && <Badge className={status.className}>{status.label}</Badge>}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-3">
                      <img src={images[activeImage]} alt="Car preview" className="h-72 w-full rounded-2xl object-cover md:h-[360px]" />
                      <div className="flex items-center gap-2">
                        <Button variant="subtle" onClick={() => setActiveImage((prev) => Math.max(0, prev - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex w-full gap-2 overflow-x-auto">
                          {images.slice(0, 8).map((img, i) => (
                            <button key={`${img}-${i}`} onClick={() => setActiveImage(i)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl border ${i === activeImage ? "border-[#F5C542]" : "border-white/10"}`}>
                              <img src={img} alt={`car-${i}`} className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                        <Button variant="subtle" onClick={() => setActiveImage((prev) => Math.min(images.length - 1, prev + 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Цена в Корее", value: car.price, icon: BadgeDollarSign },
                        { label: "Цена в тенге", value: formatKzt(car.carPriceKzt), icon: Globe2 },
                        { label: "Таможня", value: formatKzt(Number(car.customs || 0)), icon: FileCheck2 },
                        { label: "Логистика", value: formatKzt(car.logistics), icon: Truck },
                        { label: "Утиль", value: formatKzt(car.util), icon: ShieldCheck },
                        { label: "Брокер", value: formatKzt(car.broker), icon: Car },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#1A1A1A] p-4">
                          <div className="flex items-center gap-3 text-zinc-300">
                            <row.icon className="h-4 w-4 text-[#F5C542]" />
                            <span>{row.label}</span>
                          </div>
                          <span className="font-medium text-white">{row.value}</span>
                        </div>
                      ))}
                      <div className="rounded-2xl border border-[#F5C542]/35 bg-gradient-to-r from-[#F5C542]/20 to-transparent p-5">
                        <p className="text-sm text-zinc-300">Итоговая цена в Казахстане</p>
                        <p className="mt-1 text-3xl font-semibold text-[#F5C542] md:text-4xl">{formatKzt(car.total)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: Clock3, title: "2 минуты до оценки", text: "Автоматический расчет по карточке авто без Excel и ручных формул." },
            { icon: ShieldCheck, title: "Прозрачная структура", text: "Таможня, логистика, утиль и брокер собраны в понятный breakdown." },
            { icon: Gauge, title: "Решения быстрее", text: "Сравнивайте бюджеты и выбирайте сделки с максимальной выгодой." },
          ].map((item, index) => (
            <motion.div key={item.title} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} transition={{ delay: index * 0.08 }}>
              <Card>
                <CardContent className="space-y-3 p-6">
                  <item.icon className="h-5 w-5 text-[#F5C542]" />
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm text-zinc-300">{item.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="mb-6 text-3xl font-semibold">Процесс импорта</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: Globe2, title: "Выбор авто", text: "Подбираете вариант на Encar." },
              { icon: BadgeDollarSign, title: "Финальный расчет", text: "Считаем до тенге за 1 клик." },
              { icon: Truck, title: "Доставка", text: "Логистика и оформление под ключ." },
              { icon: CheckCircle2, title: "Выдача в РК", text: "Получаете готовый авто пакет." },
            ].map((step, i) => (
              <Card key={step.title}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <step.icon className="h-5 w-5 text-[#F5C542]" />
                    <span className="text-xs text-zinc-500">0{i + 1}</span>
                  </div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-zinc-300">{step.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { name: "Аслан К.", role: "BMW X5", quote: "Все расходы были посчитаны точно, без неприятных сюрпризов." },
            { name: "Мадина Р.", role: "Mercedes E-Class", quote: "Лучший UX среди сервисов по импорту. Сразу видно уровень." },
            { name: "Ермек Т.", role: "Kia Carnival", quote: "Принял решение о покупке в тот же день благодаря расчету." },
          ].map((review) => (
            <Card key={review.name}>
              <CardContent className="space-y-3 p-6">
                <div className="flex gap-1 text-[#F5C542]">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                <p className="text-zinc-200">{review.quote}</p>
                <p className="text-sm text-zinc-400">{review.name} · {review.role}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="mb-6 text-3xl font-semibold">FAQ</h2>
          <div className="space-y-3">
            {[
              ["Расчет финальный?", "Это предварительная коммерческая оценка. Финальные цифры подтверждаются по VIN и документам."],
              ["Как быстро обновляются ставки?", "Курсы и внутренние коэффициенты регулярно обновляются в сервисе."],
              ["Можно ли считать несколько авто?", "Да, без ограничений по количеству расчетов."],
            ].map(([q, a]) => (
              <Card key={q}>
                <CardContent className="p-0">
                  <details className="group p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                      <span className="flex items-center gap-2"><CircleHelp className="h-4 w-4 text-[#F5C542]" />{q}</span>
                      <span className="text-zinc-500 group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <p className="pt-3 text-sm text-zinc-300">{a}</p>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <footer className="mt-16 border-t border-white/10 py-8 text-sm text-zinc-400">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>ENCAR Import SaaS · Казахстан</p>
            <p>© {new Date().getFullYear()} Premium Auto Import Platform</p>
          </div>
        </footer>
      </div>
    </main>
  )
}
