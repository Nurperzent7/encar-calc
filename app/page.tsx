"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BadgeDollarSign,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  Gauge,
  Globe2,
  ShieldCheck,
  Truck,
} from "lucide-react"

import { EncarBodyScheme, META_BY_CODE } from "@/components/EncarBodyScheme"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getPrimaryRegFee, getUtilFee } from "@/lib/fees"

type CarResult = {
  title: string
  year: string | number
  mileage: string
  price: string
  images?: string[]
  customs?: string | number
  customsDetails?: {
    foundModel?: string
    excelYear?: number
    carYear?: number
    originalPrice?: number
    depreciationYears?: number
    depreciationPercent?: string
    finalPriceUsd?: number
    rate?: number
  } | null
  carPriceUsd: number
  carPriceKzt: number
  logisticsUsd: number
  logistics: number
  serviceFeeUsd: number
  serviceFee: number
  util: number
  firstReg: number
  excise: number
  broker: number
  svhExpenses: number
  total: number
  selectedEngine: string
  insuranceRecords?: Array<{
    date: string
    type: string
    amount: number
    description: string
  }>
  insuranceSummary?: {
    myAccidentCnt?: number
    otherAccidentCnt?: number
    ownerChangeCnt?: number
    myAccidentCost?: number
    otherAccidentCost?: number
    vehicleNo?: string
  } | null
  bodyDamage?: Array<{ part: string; status: string; code?: string }>
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
  const [heydealerUrl, setHeydealerUrl] = useState("")
  const [engine, setEngine] = useState("2.0")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeImage, setActiveImage] = useState(0)
  const [car, setCar] = useState<CarResult | null>(null)

  // Поля для ручного ввода курсов
  const [usdKztRate, setUsdKztRate] = useState(500)
  const [krwUsdRate, setKrwUsdRate] = useState(1450)
  const [deliveryUsd, setDeliveryUsd] = useState(2500)
  const [customsKzt, setCustomsKzt] = useState(0)
  const [asiaTradeFee, setAsiaTradeFee] = useState(800)

  const handleCalculate = async () => {
    setError("")
    const encarLink = url.trim()
    const heydealerLink = heydealerUrl.trim()

    if (!encarLink && !heydealerLink) {
      setError("Введите ссылку Encar или HeyDealer.")
      return
    }

    if (encarLink && heydealerLink) {
      setError("Введите только одну ссылку — Encar или HeyDealer.")
      return
    }

    const targetUrl = heydealerLink || encarLink
    const isHeyDealer = heydealerLink.length > 0

    if (encarLink && !encarLink.includes("encar.com")) {
      setError("Введите корректную ссылку Encar.")
      return
    }

    if (
      heydealerLink &&
      !heydealerLink.includes("heydealer.com") &&
      !heydealerLink.startsWith("heydealer://")
    ) {
      setError("Введите корректную ссылку HeyDealer.")
      return
    }

    try {
      setLoading(true)
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, engine }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Ошибка расчета")

      const krwPrice = Number(String(data.price || "").replace(/[^\d]/g, "")) || 0
      const carPriceUsd = Math.round(krwPrice / krwUsdRate)
      const carPriceKzt = Math.round(carPriceUsd * usdKztRate)
      const logisticsUsd = deliveryUsd
      const logistics = Math.round(deliveryUsd * usdKztRate)
      const serviceFeeUsd = isHeyDealer || data.source === "heydealer" ? 1000 : 700
      const serviceFee = Math.round(700 * usdKztRate)
      const svhExpenses = 550000
      const engineVolume = Number(engine)
      const util =
        Number(String(data.recycle || "").replace(/[^\d]/g, "")) ||
        getUtilFee(engineVolume)
      const carYear = Number(data.year) || new Date().getFullYear()
      const firstReg =
        Number(String(data.primary || "").replace(/[^\d]/g, "")) ||
        getPrimaryRegFee(carYear)
      const excise = engineVolume >= 3 ? engineVolume * 100000 : 0
      const broker = 500000
      // Используем введённую таможню или дефолт из API
      const customs = customsKzt > 0 ? customsKzt : (Number(String(data.customs || "").replace(/[^\d]/g, "")) || 0)
      // Итог = цена авто + логистика + услуга + таможня + утиль + первичная регистрация + акциз + брокер + СВХ
      const total = carPriceKzt + logistics + serviceFee + customs + util + firstReg + excise + broker + svhExpenses

      const cleanTitle = (data.title || "Автомобиль из Кореи")
        .replace(/Sell My Car/gi, "")
        .replace(/Buy My Car/gi, "")
        .replace(/Used Car/gi, "")
        .replace(/\s+/g, " ")
        .replace(/[,:]+$/, "")
        .trim()

      const uniqueImages = (() => {
        const seen = new Set<string>()
        const out: string[] = []
        for (const raw of Array.isArray(data.images) ? data.images : []) {
          const url = String(raw).replace(/&amp;/g, "&")
          const key = url.match(/(\d+_\d+)\.(jpg|jpeg|png|webp)/i)?.[1]?.toLowerCase() || url.split("?")[0]
          if (seen.has(key)) continue
          seen.add(key)
          out.push(url)
          if (out.length >= 20) break
        }
        return out
      })()

      setCar({
        title: cleanTitle,
        year: data.year || "Unknown",
        mileage: data.mileage || "Unknown",
        price: formatKrw(krwPrice),
        images: uniqueImages,
        customs,
        customsDetails: data.customsDetails,
        carPriceUsd,
        carPriceKzt,
        logisticsUsd,
        logistics,
        serviceFeeUsd,
        serviceFee,
        util,
        firstReg,
        excise,
        broker,
        svhExpenses,
        total,
        selectedEngine: `${engine} л`,
        insuranceRecords: Array.isArray(data.insuranceRecords) ? data.insuranceRecords : [],
        insuranceSummary: data.insuranceSummary || null,
        bodyDamage: Array.isArray(data.bodyDamage) ? data.bodyDamage : [],
      })
      setActiveImage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить расчет")
    } finally {
      setLoading(false)
    }
  }

  const downloadCarData = async () => {
    if (!car) return
    const element = document.getElementById("car-pdf-content")
    if (!element) return
    const wrap = element.parentElement

    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      // На мобилке превью скрыто — временно показываем для снимка
      const prevWrap = wrap
        ? {
            className: wrap.className,
            position: wrap.style.position,
            left: wrap.style.left,
            top: wrap.style.top,
            width: wrap.style.width,
            height: wrap.style.height,
            overflow: wrap.style.overflow,
            opacity: wrap.style.opacity,
            zIndex: wrap.style.zIndex,
          }
        : null
      if (wrap) {
        wrap.className = ""
        wrap.style.position = "fixed"
        wrap.style.left = "0"
        wrap.style.top = "0"
        wrap.style.width = "794px"
        wrap.style.height = "1123px"
        wrap.style.overflow = "visible"
        wrap.style.opacity = "1"
        wrap.style.zIndex = "-1"
      }

      // Фиксируем A4 перед снимком, чтобы пропорции совпали со страницей
      const prev = {
        width: element.style.width,
        height: element.style.height,
        maxWidth: element.style.maxWidth,
        margin: element.style.margin,
      }
      element.style.width = "794px"
      element.style.maxWidth = "794px"
      element.style.height = "1123px"
      element.style.margin = "0"

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
      })

      element.style.width = prev.width
      element.style.height = prev.height
      element.style.maxWidth = prev.maxWidth
      element.style.margin = prev.margin
      if (wrap && prevWrap) {
        wrap.className = prevWrap.className
        wrap.style.position = prevWrap.position
        wrap.style.left = prevWrap.left
        wrap.style.top = prevWrap.top
        wrap.style.width = prevWrap.width
        wrap.style.height = prevWrap.height
        wrap.style.overflow = prevWrap.overflow
        wrap.style.opacity = prevWrap.opacity
        wrap.style.zIndex = prevWrap.zIndex
      }

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 0

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        margin,
        margin,
        pageW - margin * 2,
        pageH - margin * 2
      )
      pdf.save(`${car.title.replace(/\s+/g, "_")}_offer.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
      alert("Не удалось создать PDF. Попробуйте еще раз.")
    }
  }

  const images = car?.images?.length ? car.images : ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1200&auto=format&fit=crop"]

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0A0A0A] text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#F5C542]/10 blur-[120px]" />
      <div className="mx-auto w-full max-w-7xl px-3 pb-20 pt-4 sm:px-4 md:px-8 md:pb-16 md:pt-6 lg:px-12">
        <header className="mb-4 flex items-center gap-3 md:mb-6">
          <img
            src="/logo.jpg"
            alt="avtodom969"
            className="h-9 w-9 rounded-full object-cover ring-1 ring-[#F5C542]/40 md:h-10 md:w-10"
          />
          <span className="text-base font-semibold tracking-wide text-[#F5C542] md:text-xl">
            avtodom969
          </span>
        </header>
        <motion.section initial="hidden" animate="show" variants={fadeUp} transition={{ duration: 0.6 }} className="grid items-center gap-6 py-6 md:grid-cols-2 md:gap-10 md:py-16">
          <div className="space-y-4 md:space-y-6">
            <h1 className="text-balance text-4xl font-bold leading-tight text-[#F5C542] sm:text-5xl md:text-7xl">
              AVTODOM969
            </h1>
            <h2 className="text-balance text-xl font-semibold leading-tight text-zinc-200 sm:text-2xl md:text-3xl">
              Импорт авто из Кореи в Казахстан
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="w-full sm:w-auto" onClick={() => document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" })}>
                Рассчитать стоимость <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 sm:flex sm:flex-wrap sm:gap-3 sm:pt-2">
              <Button variant="ghost" onClick={() => window.open("https://wa.me/77076961969", "_blank")} className="border border-green-500/50 px-2 text-xs text-green-400 hover:bg-green-500/10 sm:px-5 sm:text-sm">
                WhatsApp
              </Button>
              <Button variant="ghost" onClick={() => window.open("https://www.instagram.com/avtodom969/", "_blank")} className="border border-pink-500/50 px-2 text-xs text-pink-400 hover:bg-pink-500/10 sm:px-5 sm:text-sm">
                Instagram
              </Button>
              <Button variant="ghost" onClick={() => window.open("https://t.me/avtodom969", "_blank")} className="border border-blue-500/50 px-2 text-xs text-blue-400 hover:bg-blue-500/10 sm:px-5 sm:text-sm">
                Telegram
              </Button>
            </div>
          </div>
          <Card className="relative overflow-hidden bg-black">
            <img
              src="/logo.jpg"
              alt="AVTODOM969"
              className="h-[220px] w-full object-contain sm:h-[340px] md:h-[430px]"
            />
          </Card>
        </motion.section>

        <section id="calculator" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-6 md:p-8">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-semibold sm:text-2xl md:text-3xl">Калькулятор стоимости</h2>
                  <Badge className="w-fit bg-[#F5C542]/10 text-[#F5C542]">Live Estimate</Badge>
                </div>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Вставьте ссылку Encar"
                />
                <Input
                  value={heydealerUrl}
                  onChange={(e) => setHeydealerUrl(e.target.value)}
                  placeholder="Вставьте ссылку HeyDealer"
                />
                <Select value={engine} onChange={(e) => setEngine(e.target.value)}>
                  {["1.0", "1.3", "1.5", "1.6", "2.0", "2.2", "2.4", "2.5", "3.0", "3.3", "3.5", "4.0", "4.4", "5.0", "5.5", "6.0", "6.2"].map((item) => (
                    <option key={item} value={item}>{item} л</option>
                  ))}
                </Select>

                {/* Поля для курсов валют */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400">Курс USD → KZT</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={usdKztRate}
                      onChange={(e) => setUsdKztRate(Number(e.target.value))}
                      placeholder="500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Курс KRW → USD</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={krwUsdRate}
                      onChange={(e) => setKrwUsdRate(Number(e.target.value))}
                      placeholder="1450"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400">Доставка (USD)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={deliveryUsd}
                      onChange={(e) => setDeliveryUsd(Number(e.target.value))}
                      placeholder="2500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Таможня (₸)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={customsKzt}
                      onChange={(e) => setCustomsKzt(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-rose-300">{error}</p>}
                <Button size="lg" className="w-full" onClick={handleCalculate} disabled={loading}>
                  {loading ? "Считаем..." : "Рассчитать"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.aside initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <Card className="lg:sticky lg:top-6">
              <CardContent className="space-y-4 p-4 sm:p-6">
                <p className="text-sm uppercase tracking-wide text-zinc-400">Стоимость под ключ</p>
                <div className="space-y-3 text-sm text-zinc-300">
                  {car ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <span>Цена до Алматы:</span>
                        <span className="text-right">
                          ${new Intl.NumberFormat("en-US").format(car.carPriceUsd + car.logisticsUsd + car.serviceFeeUsd)}
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            {formatKzt(car.carPriceKzt + car.logistics + car.serviceFee)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Расходы в Казахстане:</span>
                        <span>{formatKzt((Number(car.customs) || 0) + car.util + car.firstReg + car.svhExpenses + car.broker + car.excise)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-zinc-700 pt-2">
                        <span className="text-white font-medium">Итого:</span>
                        <span className="text-[#F5C542] font-semibold">{formatKzt(car.total)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-zinc-500">Введите ссылку для расчета</div>
                  )}
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
            <motion.div id="car-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="space-y-5 p-4 sm:space-y-6 sm:p-6 md:p-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <h3 className="text-xl font-semibold leading-snug sm:text-2xl md:text-3xl">{car.title}</h3>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <Button variant="subtle" className="w-full sm:w-auto" onClick={downloadCarData}>
                        <Download className="mr-2 h-4 w-4" />
                        Скачать PDF
                      </Button>
                    </div>
                  </div>

                  {/* Две колонки: фото + инфо */}
                  <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                    {/* Левая колонка - фото */}
                    <div className="space-y-3">
                      <img src={images[activeImage]} alt="Car preview" className="h-52 w-full rounded-2xl object-cover sm:h-72 md:h-[320px]" />
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button variant="subtle" className="shrink-0 px-3" onClick={() => setActiveImage((prev) => Math.max(0, prev - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {images.slice(0, 20).map((img, i) => (
                            <button key={img} onClick={() => setActiveImage(i)} className={`h-12 w-16 shrink-0 overflow-hidden rounded-xl border sm:h-14 sm:w-20 ${i === activeImage ? "border-[#F5C542]" : "border-white/10"}`}>
                              <img src={img} alt={`car-${i + 1}`} className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                        <Button variant="subtle" className="shrink-0 px-3" onClick={() => setActiveImage((prev) => Math.min(images.length - 1, prev + 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Правая колонка - прайс */}
                    <div className="space-y-3">
                      {/* Данные в USD */}
                      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-3">
                        <p className="mb-2 text-xs text-zinc-500">Стоимость в Корее:</p>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-zinc-300 sm:text-sm">Фактическая стоимость:</span>
                            <span className="shrink-0 text-right font-medium text-white">${new Intl.NumberFormat("en-US").format(car.carPriceUsd)}</span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-zinc-300 sm:text-sm">Логистика:</span>
                            <span className="shrink-0 text-right font-medium text-white">${new Intl.NumberFormat("en-US").format(car.logisticsUsd)}</span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-zinc-300 sm:text-sm">Услуга:</span>
                            <span className="shrink-0 text-right font-medium text-white">${car.serviceFeeUsd}</span>
                          </div>
                        </div>
                      </div>

                      {/* Разделитель */}
                      <div className="py-1 text-center sm:py-2">
                        <p className="text-[11px] leading-snug text-zinc-500 sm:text-xs">— расходы оформление по прибытию авто —</p>
                      </div>

                      {/* Данные в KZT */}
                      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-zinc-300 sm:text-sm">Растаможка (пошлина+НДС):</span>
                            <span className="shrink-0 text-right font-medium text-white">{formatKzt(Number(car.customs || 0))}</span>
                          </div>
                          {car.customsDetails && car.customsDetails.finalPriceUsd && car.customsDetails.finalPriceUsd > 0 && (
                            <div className="mt-1 rounded-lg bg-zinc-800/50 p-2">
                              <p className="mb-1 text-xs text-zinc-400">Расчет таможни:</p>
                              <div className="space-y-1 text-[11px] text-zinc-300 sm:text-xs">
                                <div className="flex justify-between gap-2">
                                  <span className="shrink-0">Найдена модель:</span>
                                  <span className="truncate text-right text-white">{car.customsDetails.foundModel}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span>Год в таблице:</span>
                                  <span className="text-white">{car.customsDetails.excelYear}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span>Год вашего авто:</span>
                                  <span className="text-white">{car.customsDetails.carYear}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span>Цена в таблице:</span>
                                  <span className="text-white">${car.customsDetails.originalPrice?.toLocaleString()}</span>
                                </div>
                                {(car.customsDetails.depreciationYears ?? 0) > 0 && (
                                  <>
                                    <div className="flex justify-between gap-2">
                                      <span>Лет разницы:</span>
                                      <span className="text-white">{car.customsDetails.depreciationYears}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span>Учтено стоимости:</span>
                                      <span className="text-[#F5C542]">{car.customsDetails.depreciationPercent}</span>
                                    </div>
                                  </>
                                )}
                                <div className="mt-1 flex justify-between gap-2 border-t border-zinc-600 pt-1">
                                  <span>Итоговая цена USD:</span>
                                  <span className="font-medium text-white">${car.customsDetails.finalPriceUsd?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span>Курс таможни:</span>
                                  <span className="text-white">× {car.customsDetails.rate ?? 468}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-zinc-300 sm:text-sm">Утильсбор:</span>
                            <span className="shrink-0 text-right font-medium text-white">{formatKzt(car.util)}</span>
                          </div>
                          {car.excise > 0 && (
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-xs text-zinc-300 sm:text-sm">Акциз (двигатель ≥3.0L):</span>
                              <span className="shrink-0 text-right font-medium text-white">{formatKzt(car.excise)}</span>
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-zinc-300 sm:text-sm">Первичная регистрация:</span>
                            <span className="shrink-0 text-right font-medium text-white">{formatKzt(car.firstReg)}</span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-zinc-300 sm:text-sm">СВХ расходы:</span>
                            <span className="shrink-0 text-right font-medium text-white">{formatKzt(car.svhExpenses)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Итог */}
                      <div className="rounded-2xl border border-[#F5C542]/35 bg-gradient-to-r from-[#F5C542]/20 to-transparent p-3 sm:p-4">
                        <p className="text-sm text-zinc-300">Стоимость под ключ:</p>
                        <p className="mt-1 break-all text-xl font-semibold text-[#F5C542] sm:text-2xl md:text-3xl">{formatKzt(car.total)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Кнопка Telegram внизу */}
                  <Button
                    size="lg"
                    className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white"
                    onClick={() => window.open("https://t.me/avtodom969", "_blank")}
                  >
                    Написать в Telegram
                  </Button>

                  {/* Схема кузова Encar */}
                  <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-3 sm:p-4">
                    <h3 className="mb-3 text-base font-semibold text-[#F5C542] sm:text-lg">Состояние кузова</h3>
                    <EncarBodyScheme bodyDamage={car.bodyDamage || []} />
                    {(car.bodyDamage?.length ?? 0) > 0 ? (
                      <div className="mt-3 space-y-2">
                        {car.bodyDamage!.map((d, i) => {
                          const code = (d.code || "").toUpperCase()
                          const meta = META_BY_CODE[code]
                          return (
                            <div
                              key={`${d.part}-${code}-${i}`}
                              className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-zinc-900/60 px-3 py-2.5 sm:gap-3 sm:px-4"
                            >
                              <span className="min-w-0 truncate text-sm text-white">{d.part}</span>
                              <span className="flex shrink-0 items-center gap-2 text-xs font-semibold" style={{ color: meta?.color || "#F5C542" }}>
                                {meta && (
                                  <span
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                                    style={{ background: meta.color }}
                                  >
                                    {code}
                                  </span>
                                )}
                                <span className="hidden sm:inline">{meta?.labelRu || d.status}</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">Повреждений кузова в отчёте Encar не отмечено.</p>
                    )}
                  </div>

                  {/* Страховая история Encar */}
                  <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-3 sm:p-4">
                    <h3 className="mb-3 text-base font-semibold text-[#F5C542] sm:text-lg">Страховая история</h3>
                    {car.insuranceSummary?.vehicleNo && (
                      <p className="mb-3 text-xs text-zinc-500">Номер авто: {car.insuranceSummary.vehicleNo}</p>
                    )}
                    <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
                      <div className="rounded-xl bg-zinc-900/80 p-2.5 text-center sm:p-3">
                        <p className="text-lg font-bold text-white sm:text-xl">{car.insuranceRecords?.length ?? 0}</p>
                        <p className="mt-1 text-[10px] text-zinc-500 sm:text-[11px]">Случаев</p>
                      </div>
                      <div className="rounded-xl bg-zinc-900/80 p-2.5 text-center sm:p-3">
                        <p className="text-lg font-bold text-white sm:text-xl">{car.insuranceSummary?.myAccidentCnt ?? 0}</p>
                        <p className="mt-1 text-[10px] text-zinc-500 sm:text-[11px]">Своё ДТП</p>
                      </div>
                      <div className="rounded-xl bg-zinc-900/80 p-2.5 text-center sm:p-3">
                        <p className="text-lg font-bold text-white sm:text-xl">{car.insuranceSummary?.otherAccidentCnt ?? 0}</p>
                        <p className="mt-1 text-[10px] text-zinc-500 sm:text-[11px]">Чужое ДТП</p>
                      </div>
                      <div className="rounded-xl bg-zinc-900/80 p-2.5 text-center sm:p-3">
                        <p className="text-lg font-bold text-white sm:text-xl">{car.insuranceSummary?.ownerChangeCnt ?? 0}</p>
                        <p className="mt-1 text-[10px] text-zinc-500 sm:text-[11px]">Смен владельца</p>
                      </div>
                    </div>
                    {(car.insuranceRecords?.length ?? 0) > 0 ? (
                      <div className="space-y-2">
                        {car.insuranceRecords!.map((rec, i) => (
                          <div key={`${rec.date}-${rec.type}-${i}`} className="rounded-xl border border-white/5 bg-zinc-900/60 px-3 py-3 sm:px-4">
                            <div className="flex items-start justify-between gap-2 sm:gap-3">
                              <span className="text-sm font-medium text-white">{rec.type}</span>
                              {rec.date ? <span className="shrink-0 text-xs text-zinc-500">{rec.date}</span> : null}
                            </div>
                            {rec.amount > 0 && (
                              <p className="mt-1 text-xs font-semibold text-[#F5C542]">
                                Выплата: {new Intl.NumberFormat("ru-RU").format(rec.amount)} ₩
                              </p>
                            )}
                            {rec.description ? (
                              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{rec.description}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        Страховые случаи не найдены или история закрыта на Encar.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Элемент для PDF генерации — скрыт на мобилке, на desktop превью */}
          {car && (
            <div className="mt-5 hidden overflow-x-auto md:block">
            <div
              id="car-pdf-content"
              className="pdf-content"
              style={{
                width: "794px",
                height: "1123px",
                maxWidth: "794px",
                boxSizing: "border-box",
                background: "#fff",
                color: "#1a1a1a",
                padding: "18px 20px",
                fontFamily: "Arial, Helvetica, sans-serif",
                margin: "0 auto",
                boxShadow: "0 4px 30px rgba(0,0,0,0.4)",
                position: "relative",
                zIndex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Шапка */}
              <div style={{ textAlign: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "2px solid #F5C542", flexShrink: 0 }}>
                <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>ПРЕДЛОЖЕНИЕ ДЛЯ КЛИЕНТА</h1>
                <p style={{ fontSize: "11px", color: "#666", margin: "4px 0 0" }}>AVTODOM969 · Premium Auto Import from Korea</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "14px", marginBottom: "12px", flexShrink: 0 }}>
                {/* Левая колонка */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ height: "168px", overflow: "hidden", borderRadius: "8px", marginBottom: "8px", backgroundColor: "#f0f0f0" }}>
                    <img src={`/api/image?url=${encodeURIComponent(images[0])}`} alt="Car" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                  <h2 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 6px", lineHeight: 1.3, color: "#000" }}>{car.title}</h2>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px", padding: "4px 0", borderBottom: "1px solid #e0e0e0" }}>
                      <span style={{ color: "#666" }}>Год:</span>
                      <span style={{ fontWeight: 600 }}>{car.year}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px", padding: "4px 0", borderBottom: "1px solid #e0e0e0" }}>
                      <span style={{ color: "#666" }}>Пробег:</span>
                      <span style={{ fontWeight: 600 }}>{car.mileage}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px", padding: "4px 0" }}>
                      <span style={{ color: "#666" }}>Цена в Корее:</span>
                      <span style={{ fontWeight: 700, color: "#d4a017" }}>{car.price}</span>
                    </div>
                  </div>
                </div>

                {/* Правая колонка - прайс */}
                <div style={{ minWidth: 0, backgroundColor: "#f5f5f5", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" }}>
                  <div style={{ backgroundColor: "#F5C542", padding: "7px", borderRadius: "4px", textAlign: "center", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "12px", fontWeight: 700, margin: 0, color: "#000" }}>ЧТО ВХОДИТ В СТОИМОСТЬ</h3>
                  </div>

                  <div style={{ fontSize: "11px", color: "#333", marginBottom: "6px" }}>
                    <p style={{ fontSize: "9px", color: "#666", margin: "0 0 4px" }}>Стоимость в Корее:</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: "12px", rowGap: "3px", alignItems: "baseline" }}>
                      <span>Фактическая стоимость:</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>${new Intl.NumberFormat("en-US").format(car.carPriceUsd)}</span>
                      <span>Логистика:</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>${new Intl.NumberFormat("en-US").format(car.logisticsUsd)}</span>
                      <span>Услуга:</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>${car.serviceFeeUsd}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: "center", margin: "6px 0", fontSize: "9px", color: "#666" }}>
                    — расходы оформление по прибытию авто —
                  </div>

                  <div style={{ fontSize: "11px", color: "#333" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: "12px", rowGap: "3px", alignItems: "baseline" }}>
                      <span>Растаможка (пошлина+НДС):</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{new Intl.NumberFormat("ru-RU").format(Number(car.customs || 0))} ₸</span>
                      <span>Утильсбор:</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{new Intl.NumberFormat("ru-RU").format(car.util)} ₸</span>
                      {car.excise > 0 && (
                        <>
                          <span>Акциз (двигатель ≥3.0L):</span>
                          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{new Intl.NumberFormat("ru-RU").format(car.excise)} ₸</span>
                        </>
                      )}
                      <span>Первичная регистрация:</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{new Intl.NumberFormat("ru-RU").format(car.firstReg)} ₸</span>
                      <span>СВХ расходы:</span>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{new Intl.NumberFormat("ru-RU").format(car.svhExpenses)} ₸</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: "12px", marginTop: "8px", paddingTop: "8px", borderTop: "2px solid #F5C542", fontWeight: 700, fontSize: "13px", alignItems: "baseline" }}>
                      <span>Стоимость под ключ:</span>
                      <span style={{ whiteSpace: "nowrap" }}>{new Intl.NumberFormat("ru-RU").format(car.total)} ₸</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Сетка фото */}
              <div style={{ flex: 1, minHeight: 0, marginBottom: "10px" }}>
                <h3 style={{ fontSize: "11px", fontWeight: 600, margin: "0 0 6px", color: "#666" }}>ФОТОГРАФИИ АВТОМОБИЛЯ:</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px" }}>
                  {images.map((img, i) => (
                    <div key={img} style={{ aspectRatio: "4 / 3", overflow: "hidden", borderRadius: "4px", background: "#eee" }}>
                      <img src={`/api/image?url=${encodeURIComponent(img)}`} alt={`car-${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Контакты */}
              <div style={{ background: "linear-gradient(135deg, #0088cc 0%, #0077b5 100%)", color: "white", padding: "12px", borderRadius: "8px", textAlign: "center", flexShrink: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 2px" }}>Готовы к покупке? Свяжитесь с нами!</p>
                <p style={{ fontSize: "15px", fontWeight: 700, margin: "2px 0" }}>Telegram: @avtodom969</p>
                <p style={{ fontSize: "10px", margin: "2px 0 0", opacity: 0.9 }}>https://t.me/avtodom969</p>
              </div>
            </div>
            </div>
          )}
        </section>

        <section className="mt-10 md:mt-16">
          <h2 className="mb-4 text-2xl font-semibold sm:mb-6 sm:text-3xl">Процесс импорта</h2>
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

        <section className="mt-10 md:mt-16">
          <h2 className="mb-4 text-2xl font-semibold sm:mb-6 sm:text-3xl">Encar — покупка авто из Кореи</h2>
          <Card>
            <CardContent className="space-y-5 p-4 sm:space-y-6 sm:p-6">
              <div className="rounded-lg bg-zinc-900/50 p-4">
                <h3 className="mb-3 font-bold text-[#F5C542]">1. Наша услуга — <span className="text-white">700$</span></h3>
                <p className="text-sm text-zinc-300">В эту стоимость входит автоподбор. С Вами мы подберем автомобиль под ваши требования и предпочтения. Далее, интересующий вас автомобиль наши сотрудники в Корее поедут проверять на тех.состояние, наличие повреждений, дефектов и т.д. Все это сопровождается обязательным видеоотчетом для вас.</p>
              </div>

              <div className="rounded-lg bg-zinc-900/50 p-4">
                <h3 className="mb-3 font-bold text-[#F5C542]">2. Покупка и доставка</h3>
                <p className="mb-3 text-sm text-zinc-300">Когда уже утвердили покупку автомобиля, продавец авто выставляет счет на оплату (инвойс) на стоимость через наш офис в Республике Корея. Вы должны будете оплатить инвойс через банк в течении трех дней.</p>
                <p className="mb-3 text-sm text-zinc-300">Еще оплачиваются логистические расходы до Алматы — <span className="font-bold text-white">2000$</span>. После мы бронируем автомобиль, вносим задаток. После поступления оплаты за машину (обычно 3 рабочих дней) привозят к нам на парковку (в Корее), готовят экспортную документацию и отправляют в порт.</p>
                <p className="text-sm text-zinc-300">Далее ТС грузят на корабль и отправляют в Китай, оттуда автовозы принимают наши автомобили и доставляют до Казахстана.</p>
              </div>

              <div className="rounded-lg bg-zinc-900/50 p-4">
                <h3 className="mb-3 font-bold text-[#F5C542]">3. Прибытие в Казахстан</h3>
                <p className="text-sm text-zinc-300">По прибытию автомобиля к нам в Алматы, оплачиваются таможенные пошлины и расходы, в виде сертификата безопасности, растаможки, НДС и утильсбора.</p>
              </div>

              <div className="rounded-lg border border-[#F5C542]/30 bg-[#F5C542]/5 p-4">
                <h3 className="mb-3 font-bold">📌 Сроки доставки</h3>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li>Автомобиль будет доставлен в Казахстан в течении <span className="font-bold text-white">30–35 дней</span></li>
                  <li>Таможенные процессы занимают до <span className="font-bold text-white">5 рабочих дней</span> в среднем</li>
                </ul>
              </div>

              <div className="rounded-lg bg-[#F5C542]/10 border border-[#F5C542]/30 p-4 text-center">
                <p className="text-zinc-200 font-medium">Ваше ТС в обязательном порядке будет доставлено в целости и сохранности.</p>
                <p className="text-sm text-zinc-400 mt-2">С уважением, команда Автодом.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 md:mt-16">
          <h2 className="mb-4 text-2xl font-semibold sm:mb-6 sm:text-3xl">Аукцион HeyDealer</h2>
          <Card>
            <CardContent className="space-y-5 p-4 sm:space-y-6 sm:p-6">
              <p className="text-zinc-300">
                Мы подбираем для вас лучшие варианты под ваш бюджет и запрос — отправляем лично или публикуем в Telegram. Вы выбираете автомобиль, который вам нравится.
              </p>
              <p className="text-zinc-300">
                Далее вы оплачиваете нашу услугу — <span className="font-bold text-[#F5C542]">1000$</span>, и мы заключаем с вами договор. После этого начинаем работу по аукциону.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-zinc-900/50 p-4">
                  <h3 className="mb-3 font-bold text-[#F5C542]">SELF — безопасный формат</h3>
                  <p className="mb-3 text-sm text-zinc-300">Мы ставим ставку на автомобиль. Если ставка выигрывает, наши специалисты в Корее выезжают на осмотр и проводят полную проверку: компьютерная диагностика, кузов (толщиномер), салон и техническая часть.</p>
                  <p className="text-sm text-zinc-300">После этого вы принимаете решение:</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-2"><span className="text-green-400">✔️</span> <span className="text-zinc-300">подходит — выкупаете</span></div>
                    <div className="flex items-center gap-2"><span className="text-red-400">❌</span> <span className="text-zinc-300">не подходит — отказываетесь</span></div>
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-900/50 p-4">
                  <h3 className="mb-3 font-bold text-[#F5C542]">ZERO — быстрый формат</h3>
                  <p className="mb-3 text-sm text-zinc-300">По автомобилю уже есть вся подробная информация: фото, состояние, технические данные.</p>
                  <p className="text-sm font-medium text-red-300">❗️ Если ставка выигрывает — автомобиль сразу выкупается без отказа.</p>
                </div>
              </div>

              <div className="rounded-lg border border-[#F5C542]/30 bg-[#F5C542]/5 p-4">
                <h3 className="mb-3 font-bold">📌 Как проходит оплата (по этапно)</h3>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li>Если ставка сыграла: мы проверяем автомобиль → отправляем вам полный отчёт → вы подтверждаете покупку → оплачивается фактическая стоимость авто в Корее и оплачивается логистика — <span className="font-bold text-[#F5C542]">2000$</span></li>
                  <li>Мы подготавливаем все документы: снятие с учёта и экспортные документации!</li>
                  <li>Погрузка контейнера — 1 раз в неделю.</li>
                  <li>С момента загрузки доставка в Казахстан занимает <span className="font-bold text-white">30–35 дней</span>.</li>
                </ul>
              </div>

              <div className="rounded-lg bg-zinc-900/50 p-4">
                <h3 className="mb-2 font-bold">📌 По прибытию в Казахстан оплачиваются:</h3>
                <p className="text-sm text-zinc-300">таможня, утильсбор, первичная регистрация и СВХ.</p>
              </div>

              <div className="rounded-lg bg-[#0088cc]/10 border border-[#0088cc]/30 p-4 text-center">
                <p className="text-zinc-200">📩 Можем сразу сделать просчёт под ваш бюджет и подобрать варианты под вас — просто напишите.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-16 border-t border-white/10 py-8 text-sm text-zinc-400">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>AVTODOM969 · Казахстан</p>
            <p>© 2026 AVTODOM969</p>
          </div>
        </footer>
      </div>
    </main>
  )
}

