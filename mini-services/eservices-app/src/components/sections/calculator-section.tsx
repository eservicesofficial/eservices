'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Delete,
  Trash2,
  History,
  Loader2,
  Calculator,
  Receipt,
  Brain,
  Minus,
  Plus,
  RotateCcw,
  Copy,
  ChevronDown,
  ArrowRightLeft,
  Ruler,
  Weight,
  Thermometer,
  Beaker,
  Download,
  Percent,
  IndianRupee,
  Keyboard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/components/auth-provider'
import { notify } from '@/lib/notification-store'

// --- Types ---
interface CalcHistoryEntry {
  id: string
  expression: string
  result: string
  createdAt: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CalculatorSectionProps {}

// Resolve percentage expressions into standard math
// Business calculator logic:
//   A + B% → A + (A * B / 100)
//   A - B% → A - (A * B / 100)
//   A * B% → A * (B / 100)
//   A / B% → A / (B / 100)
//   A%     → A / 100
//   A% B   → A * B / 100
function resolvePercentages(expr: string): string {
  let result = expr
  let safety = 0

  while (result.includes('%') && safety < 20) {
    safety++
    const idx = result.indexOf('%')
    const before = result.substring(0, idx)
    const after = result.substring(idx + 1)

    // Find the number immediately before %
    const trailingNum = before.match(/([\d.]+)\s*$/)
    if (!trailingNum) return 'Error'

    const pctNum = trailingNum[1]
    const rest = before.substring(0, before.length - trailingNum[0].length).trimEnd()

    // Find operator before the number
    const opBefore = rest.match(/([+\-*/])\s*$/)
    const afterOp = opBefore ? rest.substring(0, rest.length - opBefore[0].length).trimEnd() : rest
    const operator = opBefore ? opBefore[1] : null

    if (!operator) {
      // Standalone percentage: "50%" or "50%+200"
      if (/^\s*[\d(]/.test(after) && !/^\s*[\+\-*/]/.test(after)) {
        // "X%Y" pattern → X * Y / 100
        const afterNum = after.match(/^([\d.]+)/)
        if (afterNum) {
          result = `${afterOp}${pctNum} * ${afterNum[1]} / 100${after.substring(afterNum[0].length)}`
        } else {
          result = `${afterOp}(${pctNum} / 100)${after}`
        }
      } else {
        // "X%" → X / 100
        result = `${afterOp}(${pctNum} / 100)${after}`
      }
    } else if (operator === '*' || operator === '/') {
      // X * Y% → X * (Y/100), X / Y% → X / (Y/100)
      result = `${afterOp} ${operator} (${pctNum} / 100)${after}`
    } else {
      // X + Y% → X + (X * Y/100), X - Y% → X - (X * Y/100)
      const baseMatch = afterOp.match(/([\d.]+)\s*$/)
      if (baseMatch) {
        const xVal = baseMatch[1]
        const beforeBase = afterOp.substring(0, afterOp.length - baseMatch[0].length)
        result = `${beforeBase}${xVal} ${operator} (${xVal} * ${pctNum} / 100)${after}`
      } else {
        result = `${afterOp} ${operator} (${pctNum} / 100)${after}`
      }
    }
  }

  return result
}

// Generate a human-readable preview of percentage calculation
function getPercentagePreview(expression: string): string {
  if (!expression.includes('%')) return ''

  const sanitized = expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[^0-9+\-*/().%\s]/g, '')

  const resolved = resolvePercentages(sanitized)
  if (resolved === 'Error' || resolved === sanitized) return ''

  // Calculate the result for the preview
  try {
    const fn = new Function(`"use strict"; return (${resolved})`)
    const result = fn()
    if (typeof result !== 'number' || !isFinite(result)) return ''

    const displayExpression = expression
      .replace(/×/g, '×')
      .replace(/÷/g, '÷')
      .trim()

    return `${displayExpression} = ${Number.isInteger(result) ? result : parseFloat(result.toFixed(4))}`
  } catch {
    return ''
  }
}

// Safe eval for calculation
function safeCalculate(expression: string): string {
  const sanitized = expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[^0-9+\-*/().%\s]/g, '')

  if (!sanitized.trim()) return ''

  // Resolve percentage expressions first
  const resolved = resolvePercentages(sanitized)
  if (resolved === 'Error') return 'Error'

  try {
    let depth = 0
    for (const char of resolved) {
      if (char === '(') depth++
      if (char === ')') depth--
      if (depth < 0) return 'Error'
    }
    if (depth !== 0) return 'Error'
    if (/[+\-*/]$/.test(resolved.trim())) return 'Error'

    const fn = new Function(`"use strict"; return (${resolved})`)
    const result = fn()

    if (typeof result !== 'number' || !isFinite(result)) return 'Error'

    const formatted =
      Number.isInteger(result)
        ? result.toString()
        : parseFloat(result.toFixed(10)).toString()

    return formatted
  } catch {
    return 'Error'
  }
}

// --- Unit Converter Sub-Component ---

interface UnitDefinition {
  label: string
  value: string
  toBase: (val: number) => number
  fromBase: (val: number) => number
}

interface UnitCategory {
  id: string
  label: string
  icon: React.ReactNode
  units: UnitDefinition[]
}

const unitCategories: UnitCategory[] = [
  {
    id: 'length',
    label: 'Length',
    icon: <Ruler className="size-4" />,
    units: [
      { label: 'Kilometers (km)', value: 'km', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { label: 'Meters (m)', value: 'm', toBase: (v) => v, fromBase: (v) => v },
      { label: 'Centimeters (cm)', value: 'cm', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
      { label: 'Millimeters (mm)', value: 'mm', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { label: 'Inches (in)', value: 'in', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
      { label: 'Feet (ft)', value: 'ft', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
      { label: 'Yards (yd)', value: 'yd', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    icon: <Weight className="size-4" />,
    units: [
      { label: 'Kilograms (kg)', value: 'kg', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { label: 'Grams (g)', value: 'g', toBase: (v) => v, fromBase: (v) => v },
      { label: 'Milligrams (mg)', value: 'mg', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      { label: 'Pounds (lb)', value: 'lb', toBase: (v) => v * 453.592, fromBase: (v) => v / 453.592 },
      { label: 'Ounces (oz)', value: 'oz', toBase: (v) => v * 28.3495, fromBase: (v) => v / 28.3495 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    icon: <Thermometer className="size-4" />,
    units: [
      { label: 'Celsius (°C)', value: 'C', toBase: (v) => v, fromBase: (v) => v },
      { label: 'Fahrenheit (°F)', value: 'F', toBase: (v) => (v - 32) * (5 / 9), fromBase: (v) => v * (9 / 5) + 32 },
      { label: 'Kelvin (K)', value: 'K', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    icon: <Beaker className="size-4" />,
    units: [
      { label: 'Liters (L)', value: 'L', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { label: 'Milliliters (mL)', value: 'mL', toBase: (v) => v, fromBase: (v) => v },
      { label: 'Gallons (gal)', value: 'gal', toBase: (v) => v * 3785.41, fromBase: (v) => v / 3785.41 },
      { label: 'Fluid Ounces (fl oz)', value: 'floz', toBase: (v) => v * 29.5735, fromBase: (v) => v / 29.5735 },
      { label: 'Cups', value: 'cup', toBase: (v) => v * 236.588, fromBase: (v) => v / 236.588 },
    ],
  },
]

function UnitConverter() {
  const [categoryId, setCategoryId] = useState('length')
  const [fromUnit, setFromUnit] = useState('m')
  const [toUnit, setToUnit] = useState('ft')
  const [inputValue, setInputValue] = useState('')

  const category = useMemo(
    () => unitCategories.find((c) => c.id === categoryId) || unitCategories[0],
    [categoryId]
  )

  const fromDef = useMemo(
    () => category.units.find((u) => u.value === fromUnit) || category.units[0],
    [category, fromUnit]
  )

  const toDef = useMemo(
    () => category.units.find((u) => u.value === toUnit) || category.units[0],
    [category, toUnit]
  )

  const convertedValue = useMemo(() => {
    const val = parseFloat(inputValue)
    if (isNaN(val)) return ''
    const baseValue = fromDef.toBase(val)
    const result = toDef.fromBase(baseValue)
    return result
  }, [inputValue, fromDef, toDef])

  const handleCategoryChange = (newCategoryId: string) => {
    setCategoryId(newCategoryId)
    const newCat = unitCategories.find((c) => c.id === newCategoryId)
    if (newCat && newCat.units.length >= 2) {
      setFromUnit(newCat.units[0].value)
      setToUnit(newCat.units[1].value)
    }
    setInputValue('')
  }

  const handleSwap = () => {
    const temp = fromUnit
    setFromUnit(toUnit)
    setToUnit(temp)
  }

  const formatResult = (val: string | number) => {
    if (val === '' || val === undefined) return ''
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return ''
    if (Number.isInteger(num)) return num.toString()
    return parseFloat(num.toPrecision(10)).toString()
  }

  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      {/* Category Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Category</Label>
        <div className="grid grid-cols-4 gap-2">
          {unitCategories.map((cat) => (
            <Button
              key={cat.id}
              variant={categoryId === cat.id ? 'default' : 'outline'}
              className={`h-auto py-2 px-2 flex flex-col items-center gap-1.5 text-xs font-medium transition-all duration-200 ${
                categoryId === cat.id
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-200 scale-105'
                  : 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 active:scale-95'
              }`}
              onClick={() => handleCategoryChange(cat.id)}
            >
              <span className={categoryId === cat.id ? 'text-white' : 'text-muted-foreground'}>
                {cat.icon}
              </span>
              <span>{cat.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* From Input */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">From</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Enter value"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-gray-50 to-white border-2 focus:border-emerald-400 transition-colors"
          />
          <Select value={fromUnit} onValueChange={setFromUnit}>
            <SelectTrigger className="w-[140px] h-12 font-medium text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {category.units.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full border-2 border-emerald-200 hover:border-emerald-400 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 active:scale-90 transition-all duration-200"
          onClick={handleSwap}
          title="Swap units"
        >
          <ArrowRightLeft className="size-4" />
        </Button>
      </div>

      {/* To Output */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">To</Label>
        <div className="flex gap-2">
          <div className="flex-1 h-12 flex items-center px-3 text-lg font-semibold rounded-md border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800">
            {inputValue === '' ? '—' : formatResult(convertedValue)}
          </div>
          <Select value={toUnit} onValueChange={setToUnit}>
            <SelectTrigger className="w-[140px] h-12 font-medium text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {category.units.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Formula Display */}
      {inputValue !== '' && convertedValue !== '' && (
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100 dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-800/50">
          <p className="text-xs text-muted-foreground mb-1">Conversion Formula</p>
          <p className="text-sm font-mono font-medium text-emerald-700 dark:text-emerald-400">
            1 {fromDef.value} = {formatResult(toDef.fromBase(fromDef.toBase(1)))} {toDef.value}
          </p>
        </div>
      )}
    </div>
  )
}

// --- Tip Calculator Sub-Component ---
function TipSplitCalculator() {
  const [billAmount, setBillAmount] = useState('')
  const [tipPercent, setTipPercent] = useState<number | null>(15)
  const [customTip, setCustomTip] = useState('')
  const [splitCount, setSplitCount] = useState(1)

  const effectiveTip = tipPercent !== null ? tipPercent : parseFloat(customTip) || 0
  const bill = parseFloat(billAmount) || 0
  const tipAmount = bill * (effectiveTip / 100)
  const totalAmount = bill + tipAmount
  const perPerson = splitCount > 0 ? totalAmount / splitCount : totalAmount

  const tipOptions = [10, 15, 18, 20, 25]

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      {/* Bill Amount */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Bill Amount</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
            ₹
          </span>
          <Input
            type="number"
            placeholder="0.00"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            className="pl-8 h-14 text-2xl font-bold bg-gradient-to-r from-gray-50 to-white border-2 focus:border-emerald-400 transition-colors"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Tip Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Tip Percentage</Label>
        <div className="grid grid-cols-5 gap-2">
          {tipOptions.map((opt) => (
            <Button
              key={opt}
              variant={tipPercent === opt ? 'default' : 'outline'}
              className={`h-11 text-base font-bold transition-all duration-200 ${
                tipPercent === opt
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-200 scale-105'
                  : 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 active:scale-95'
              }`}
              onClick={() => {
                setTipPercent(opt)
                setCustomTip('')
              }}
            >
              {opt}%
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Custom:</span>
          <Input
            type="number"
            placeholder="%"
            value={customTip}
            onChange={(e) => {
              setCustomTip(e.target.value)
              if (e.target.value !== '') {
                setTipPercent(null)
              }
            }}
            className="h-9 w-24 text-sm"
            min="0"
          />
        </div>
      </div>

      {/* Split */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Split Between</Label>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full active:scale-90 transition-transform"
            onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
            disabled={splitCount <= 1}
          >
            <Minus className="size-4" />
          </Button>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-3xl font-bold tabular-nums w-12 text-center">{splitCount}</span>
            <span className="text-sm text-muted-foreground ml-2">
              {splitCount === 1 ? 'person' : 'people'}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full active:scale-90 transition-transform"
            onClick={() => setSplitCount(splitCount + 1)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 space-y-3 border border-emerald-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Tip Amount</span>
          <span className="text-lg font-bold text-emerald-700">
            ${formatCurrency(tipAmount)}
          </span>
        </div>
        <Separator className="bg-emerald-200" />
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-bold text-emerald-800">
            ${formatCurrency(totalAmount)}
          </span>
        </div>
        <Separator className="bg-emerald-200" />
        {splitCount > 1 && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-emerald-700">Per Person</span>
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                ${formatCurrency(perPerson)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// --- Tax Calculator Sub-Component ---
function TaxCalculator() {
  const [baseAmount, setBaseAmount] = useState('')
  const [taxRate, setTaxRate] = useState('18')
  const [copied, setCopied] = useState(false)

  const base = parseFloat(baseAmount) || 0
  const rate = parseFloat(taxRate) || 0
  const taxAmount = base * (rate / 100)
  const totalAmount = base + taxAmount
  const cgst = taxAmount / 2
  const sgst = taxAmount / 2

  const formatINR = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const handleCopy = () => {
    const text = `Base: ${formatINR(base)}\nTax (${rate}%): ${formatINR(taxAmount)}\nCGST (${(rate/2).toFixed(1)}%): ${formatINR(cgst)}\nSGST (${(rate/2).toFixed(1)}%): ${formatINR(sgst)}\nTotal: ${formatINR(totalAmount)}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const presetRates = [5, 12, 18, 28]

  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      {/* Base Amount */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Base Amount</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">₹</span>
          <Input
            type="number"
            placeholder="0.00"
            value={baseAmount}
            onChange={(e) => setBaseAmount(e.target.value)}
            className="pl-8 h-14 text-2xl font-bold bg-gradient-to-r from-gray-50 to-white border-2 focus:border-emerald-400 transition-colors"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Tax Rate */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Tax Rate (%)</Label>
        <div className="grid grid-cols-4 gap-2">
          {presetRates.map((r) => (
            <Button
              key={r}
              variant={taxRate === String(r) ? 'default' : 'outline'}
              className={`h-11 text-base font-bold transition-all duration-200 ${
                taxRate === String(r)
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-200 scale-105'
                  : 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 active:scale-95'
              }`}
              onClick={() => setTaxRate(String(r))}
            >
              {r}%
            </Button>
          ))}
        </div>
        <Input
          type="number"
          placeholder="Custom rate"
          value={taxRate}
          onChange={(e) => setTaxRate(e.target.value)}
          className="h-9 text-sm"
          min="0"
          step="0.5"
        />
      </div>

      {/* Results */}
      {base > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-100 dark:border-emerald-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tax Amount</span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatINR(taxAmount)}</span>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white dark:bg-gray-900/50 p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CGST</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(rate / 2).toFixed(1)}%</p>
                <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">{formatINR(cgst)}</p>
              </div>
              <div className="rounded-lg bg-white dark:bg-gray-900/50 p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SGST</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(rate / 2).toFixed(1)}%</p>
                <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">{formatINR(sgst)}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">Total Amount</span>
              <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(totalAmount)}</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Copy className="size-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy Result
              </>
            )}
          </Button>
        </div>
      )}

      {base === 0 && (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Percent className="size-8 mb-2 opacity-40" />
          <p className="text-sm">Enter a base amount to calculate tax</p>
        </div>
      )}
    </div>
  )
}

// --- Main Component ---
export default function CalculatorSection(_props: CalculatorSectionProps) {
  const { token } = useAuth()
  const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {}
  const [expression, setExpression] = useState('')
  const [displayResult, setDisplayResult] = useState('0')
  const [lastOperation, setLastOperation] = useState('')
  const [history, setHistory] = useState<CalcHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hasCalculated = useRef(false)

  // --- Memory state ---
  const [memory, setMemory] = useState<number>(0)

  // --- Keyboard support ---
  const [pressedKey, setPressedKey] = useState<string | null>(null)

  // --- Handlers (wrapped in useCallback for keyboard listener stability) ---
  const handleInput = useCallback((value: string) => {
    hasCalculated.current = false
    setExpression((prev) => prev + value)
  }, [])

  const handleClear = useCallback(() => {
    setExpression('')
    setDisplayResult('0')
    setLastOperation('')
    hasCalculated.current = false
  }, [])

  const handleBackspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1))
    if (hasCalculated.current) {
      setDisplayResult('0')
      hasCalculated.current = false
    }
  }, [])

  const handleCalculate = useCallback(async () => {
    // Read current expression via a ref-like pattern inside setState
    setExpression((currentExpr) => {
      if (!currentExpr.trim()) return currentExpr

      const result = safeCalculate(currentExpr)

      if (result !== 'Error' && result !== '') {
        setDisplayResult(result)
        setLastOperation(`${currentExpr} =`)

        fetch('/api/calculator', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expression: currentExpr, result }),
        }).catch(() => {})

        hasCalculated.current = true
      } else {
        setDisplayResult('Error')
      }

      return currentExpr
    })
  }, [])

  // --- Fetch history ---
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/calculator', { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (err) {
      console.error('Failed to fetch calculator history:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load memory from localStorage on mount
    try {
      const storedMemory = localStorage.getItem('calculator-memory')
      if (storedMemory !== null) {
        setMemory(parseFloat(storedMemory))
      }
    } catch {
      // localStorage not available
    }
    fetchHistory()
  }, [fetchHistory])

  // --- Persist memory to localStorage ---
  useEffect(() => {
    try {
      localStorage.setItem('calculator-memory', memory.toString())
    } catch {
      // localStorage not available
    }
  }, [memory])

  // --- Keyboard Listener ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when user is typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      let matched = false

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleInput(e.key)
        setPressedKey(e.key)
        matched = true
      } else if (e.key === '.') {
        e.preventDefault()
        handleInput('.')
        setPressedKey('.')
        matched = true
      } else if (e.key === '+') {
        e.preventDefault()
        handleInput('+')
        setPressedKey('+')
        matched = true
      } else if (e.key === '-') {
        e.preventDefault()
        handleInput('-')
        setPressedKey('-')
        matched = true
      } else if (e.key === '*') {
        e.preventDefault()
        handleInput('×')
        setPressedKey('×')
        matched = true
      } else if (e.key === '/') {
        e.preventDefault()
        handleInput('÷')
        setPressedKey('÷')
        matched = true
      } else if (e.key === '%') {
        e.preventDefault()
        handleInput('%')
        setPressedKey('%')
        matched = true
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault()
        handleCalculate()
        setPressedKey('=')
        matched = true
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
        setPressedKey('backspace')
        matched = true
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault()
        handleClear()
        setPressedKey('clear')
        matched = true
      }

      if (matched) {
        setTimeout(() => setPressedKey(null), 150)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleInput, handleClear, handleBackspace, handleCalculate])

  // --- Memory Handlers ---
  const handleMC = () => {
    setMemory(0)
  }

  const handleMR = () => {
    if (memory !== 0) {
      if (hasCalculated.current) {
        setExpression(memory.toString())
        setDisplayResult(memory.toString())
      } else {
        setExpression((prev) => prev + memory.toString())
      }
    }
  }

  const handleMPlus = () => {
    const currentValue = parseFloat(displayResult)
    if (!isNaN(currentValue)) {
      setMemory((prev) => {
        const newVal = prev + currentValue
        return parseFloat(newVal.toFixed(10))
      })
    }
  }

  const handleMMinus = () => {
    const currentValue = parseFloat(displayResult)
    if (!isNaN(currentValue)) {
      setMemory((prev) => {
        const newVal = prev - currentValue
        return parseFloat(newVal.toFixed(10))
      })
    }
  }

  const handleClearHistoryClick = () => {
    if (confirmClear) {
      // Second click within 2 seconds — actually clear
      setConfirmClear(false)
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      handleClearHistory()
    } else {
      // First click — enter confirm state
      setConfirmClear(true)
      confirmTimerRef.current = setTimeout(() => {
        setConfirmClear(false)
        confirmTimerRef.current = null
      }, 2000)
    }
  }

  const handleClearHistory = async () => {
    try {
      setClearingHistory(true)
      const res = await fetch('/api/calculator', { method: 'DELETE', headers: authHeaders })
      if (res.ok) {
        notify({ type: 'success', title: 'History Cleared', message: 'Calculator history has been cleared' })
        setHistory([])
      } else {
        notify({ type: 'error', title: 'Error', message: 'Failed to clear history' })
      }
    } catch (err) {
      console.error('Failed to clear history:', err)
      notify({ type: 'error', title: 'Error', message: 'Failed to clear history' })
    } finally {
      setClearingHistory(false)
    }
  }

  const handleHistoryClick = (entry: CalcHistoryEntry) => {
    setExpression(entry.expression)
    setDisplayResult(entry.result)
    hasCalculated.current = true
  }

  const handleExportHistory = () => {
    if (history.length === 0) return
    const lines = history.map((entry) => `${entry.expression} = ${entry.result}`)
    const content = lines.join('\n')
    const today = new Date().toISOString().split('T')[0]
    const filename = `calculator-history-${today}.txt`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  // --- Button definitions ---
  const buttons: {
    label: string
    value: string
    type: 'number' | 'operator' | 'action' | 'equals' | 'clear' | 'percent'
    span?: number
  }[] = [
    { label: 'C', value: 'clear', type: 'clear' },
    { label: '⌫', value: 'backspace', type: 'action' },
    { label: '%', value: '%', type: 'percent' },
    { label: '÷', value: '÷', type: 'operator' },

    { label: '7', value: '7', type: 'number' },
    { label: '8', value: '8', type: 'number' },
    { label: '9', value: '9', type: 'number' },
    { label: '×', value: '×', type: 'operator' },

    { label: '4', value: '4', type: 'number' },
    { label: '5', value: '5', type: 'number' },
    { label: '6', value: '6', type: 'number' },
    { label: '-', value: '-', type: 'operator' },

    { label: '1', value: '1', type: 'number' },
    { label: '2', value: '2', type: 'number' },
    { label: '3', value: '3', type: 'number' },
    { label: '+', value: '+', type: 'operator' },

    { label: '00', value: '00', type: 'number' },
    { label: '0', value: '0', type: 'number' },
    { label: '.', value: '.', type: 'number' },
    { label: '=', value: '=', type: 'equals' },
  ]

  const getButtonStyle = (type: string): string => {
    switch (type) {
      case 'operator':
        return 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-200/50 hover:from-emerald-600 hover:to-green-700 active:from-emerald-700 active:to-green-800 active:scale-95'
      case 'clear':
        return 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-200/50 hover:from-red-600 hover:to-rose-700 active:from-red-700 active:to-rose-800 active:scale-95'
      case 'equals':
        return 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200/50 hover:from-green-700 active:from-green-800 active:scale-95 ring-2 ring-green-300/50'
      case 'action':
        return 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 shadow-sm hover:from-gray-200 hover:to-gray-300 active:from-gray-300 active:to-gray-400 active:scale-95'
      case 'percent':
        return 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200/50 hover:from-violet-600 hover:to-purple-700 active:from-violet-700 active:to-purple-800 active:scale-95'
      case 'number':
      default:
        return 'bg-gradient-to-br from-white to-gray-50 text-gray-900 shadow-sm hover:from-gray-50 hover:to-gray-100 active:from-gray-100 active:to-gray-200 active:scale-95 border border-gray-200/80'
    }
  }

  const getMemoryButtonStyle = (active: boolean): string => {
    if (active) {
      return 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200/50 hover:from-amber-500 hover:to-orange-600 active:scale-95'
    }
    return 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500 shadow-sm hover:from-gray-200 hover:to-gray-300 hover:text-gray-700 active:scale-95'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Calculator className="size-5" />
        Smart Business Calculator
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calculator */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden py-0 gap-0 shadow-xl border-0 ring-1 ring-black/5">
            {/* Tab Switcher */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-3 pt-3">
              <Tabs defaultValue="calculator" className="w-full">
                <TabsList className="bg-gray-700/60 w-full h-9 rounded-lg p-0.5">
                  <TabsTrigger
                    value="calculator"
                    className="flex-1 h-8 gap-1.5 data-[state=active]:bg-gray-800 data-[state=active]:text-white rounded-md text-gray-300 text-sm transition-all duration-200"
                  >
                    <Calculator className="size-3.5" />
                    Calculator
                  </TabsTrigger>
                  <TabsTrigger
                    value="tipsplit"
                    className="flex-1 h-8 gap-1.5 data-[state=active]:bg-gray-800 data-[state=active]:text-white rounded-md text-gray-300 text-sm transition-all duration-200"
                  >
                    <Receipt className="size-3.5" />
                    Tip Split
                  </TabsTrigger>
                  <TabsTrigger
                    value="unit-converter"
                    className="flex-1 h-8 gap-1.5 data-[state=active]:bg-gray-800 data-[state=active]:text-white rounded-md text-gray-300 text-sm transition-all duration-200"
                  >
                    <Ruler className="size-3.5" />
                    Units
                  </TabsTrigger>
                  <TabsTrigger
                    value="tax-calc"
                    className="flex-1 h-8 gap-1.5 data-[state=active]:bg-gray-800 data-[state=active]:text-white rounded-md text-gray-300 text-sm transition-all duration-200"
                  >
                    <Percent className="size-3.5" />
                    Tax Calc
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="calculator" className="mt-0">
                  {/* Display */}
                  <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-white p-5 sm:p-7 relative min-h-[140px] sm:min-h-[160px]">
                    {/* Memory indicator */}
                    {memory !== 0 && (
                      <div className="absolute top-3 left-4 sm:top-4 sm:left-6">
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs font-mono gap-1"
                        >
                          <Brain className="size-3" />
                          M: {memory}
                        </Badge>
                      </div>
                    )}
                    {/* Keyboard indicator */}
                    <div className="absolute top-3 right-4 sm:top-4 sm:right-6">
                      <Badge
                        variant="secondary"
                        className="bg-white/10 text-gray-400 border-white/10 text-[10px] gap-1 font-medium"
                      >
                        <Keyboard className="size-3" />
                        <span className="hidden sm:inline">Keyboard</span>
                      </Badge>
                    </div>
                    <div className="text-right text-sm text-gray-400 min-h-[1.5em] break-all font-mono pr-1">
                      {expression || '\u00A0'}
                    </div>
                    <div className="text-right text-3xl sm:text-5xl font-bold font-mono mt-2 truncate shadow-lg text-white/95 drop-shadow-sm">
                      {expression === '' && displayResult === '0' ? '0' : displayResult}
                    </div>
                    {/* Percentage Preview Hint */}
                    {expression.includes('%') && getPercentagePreview(expression) && (
                      <div className="text-right text-[11px] text-emerald-400/80 font-mono mt-1 truncate pr-1 animate-in fade-in-0 duration-200">
                        ≡ {getPercentagePreview(expression)}
                      </div>
                    )}
                    {lastOperation && (
                      <div className="text-right text-xs text-gray-500 font-mono mt-1 truncate pr-1">
                        {lastOperation}
                      </div>
                    )}
                  </div>

                  {/* Quick Amount Preset Buttons */}
                  <div className="flex items-center justify-center gap-2 px-2 sm:px-3 pt-2 sm:pt-3">
                    <span className="text-[10px] sm:text-xs text-gray-400 font-medium mr-0.5">Quick:</span>
                    {[
                      { label: '₹100', value: '100' },
                      { label: '₹500', value: '500' },
                      { label: '₹1,000', value: '1000' },
                      { label: '₹2,000', value: '2000' },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleInput(preset.value)}
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-all duration-150 active:scale-95"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Memory Buttons Row */}
                  <div className="px-2 sm:px-3 pt-2 sm:pt-3 pb-0">
                    <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                      {[
                        { label: 'MC', handler: handleMC, icon: <RotateCcw className="size-3" /> },
                        { label: 'MR', handler: handleMR, icon: <Copy className="size-3" /> },
                        { label: 'M+', handler: handleMPlus, icon: <Plus className="size-3" /> },
                        { label: 'M-', handler: handleMMinus, icon: <Minus className="size-3" /> },
                      ].map((memBtn) => (
                        <Button
                          key={memBtn.label}
                          className={`h-8 sm:h-9 text-xs sm:text-sm font-bold rounded-lg transition-all duration-150 ${getMemoryButtonStyle(memory !== 0)}`}
                          onClick={memBtn.handler}
                          title={
                            memBtn.label === 'MC'
                              ? 'Memory Clear'
                              : memBtn.label === 'MR'
                                ? 'Memory Recall'
                                : memBtn.label === 'M+'
                                  ? 'Memory Add'
                                  : 'Memory Subtract'
                          }
                        >
                          <span className="flex items-center gap-1">
                            {memBtn.icon}
                            {memBtn.label}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Main Buttons */}
                  <div className="p-2 sm:p-3 pt-1 sm:pt-1.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      {buttons.map((btn) => {
                        const isPressed = pressedKey === btn.value ||
                          (pressedKey === 'backspace' && btn.value === 'backspace') ||
                          (pressedKey === 'clear' && btn.value === 'clear')
                        return (
                          <Button
                            key={btn.label}
                            className={`h-14 sm:h-16 text-lg sm:text-xl font-semibold rounded-xl transition-all duration-100 ${getButtonStyle(btn.type)} ${btn.span ? `col-span-${btn.span}` : ''} ${isPressed ? 'ring-2 ring-white/40 scale-95 brightness-110' : ''}`}
                            onClick={() => {
                              switch (btn.value) {
                                case 'clear':
                                  handleClear()
                                  break
                                case 'backspace':
                                  handleBackspace()
                                  break
                                case '=':
                                  handleCalculate()
                                  break
                                default:
                                  handleInput(btn.value)
                              }
                            }}
                            disabled={saving}
                          >
                            {btn.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tipsplit" className="mt-0">
                  <div className="p-4 sm:p-6">
                    <TipSplitCalculator />
                  </div>
                </TabsContent>

                <TabsContent value="unit-converter" className="mt-0">
                  <div className="p-4 sm:p-6">
                    <UnitConverter />
                  </div>
                </TabsContent>

                <TabsContent value="tax-calc" className="mt-0">
                  <div className="p-4 sm:p-6">
                    <TaxCalculator />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </div>

        {/* History Sidebar */}
        <Card className="py-0 gap-0 overflow-hidden h-fit shadow-xl border-0 ring-1 ring-black/5">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4" />
                History
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden text-xs"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? (
                    <ChevronDown className="size-4 rotate-180 transition-transform duration-200" />
                  ) : (
                    <ChevronDown className="size-4 transition-transform duration-200" />
                  )}
                </Button>
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 transition-colors duration-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={handleExportHistory}
                  >
                    <Download className="size-3.5" />
                    Export History
                  </Button>
                )}
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-xs gap-1 transition-colors duration-200 ${
                      confirmClear
                        ? 'text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold'
                        : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                    }`}
                    onClick={handleClearHistoryClick}
                    disabled={clearingHistory}
                  >
                    {clearingHistory ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : confirmClear ? (
                      <Trash2 className="size-3.5" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {clearingHistory ? 'Clearing...' : confirmClear ? 'Confirm?' : 'Clear History'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <div className={`${showHistory ? '' : 'hidden lg:block'}`}>
              {loading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-muted-foreground/15 bg-gradient-to-b from-muted/20 to-transparent">
                    <History className="size-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">No calculations yet</p>
                    <p className="text-xs text-muted-foreground/60">Your calculation history will appear here</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px] lg:max-h-[500px]">
                  <div className="space-y-2">
                    {history.map((entry) => (
                      <div key={entry.id} className="relative pl-3 border-l-2 border-green-500/30">
                        <button
                          className="w-full text-left p-3 rounded-lg border-l-0 hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 active:scale-[0.98]"
                          onClick={() => handleHistoryClick(entry)}
                        >
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {entry.expression}
                          </p>
                          <Separator className="my-1.5" />
                          <p className="text-lg font-bold font-mono">= {entry.result}</p>
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
