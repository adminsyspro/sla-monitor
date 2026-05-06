'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  date?: Date
  onSelect: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  date,
  onSelect,
  placeholder = 'Select a date',
  className,
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(date || new Date())

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate()

  const firstDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay()

  const adjustedFirstDay = firstDayOfMonth

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    )
  }

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    )
  }

  const isSelected = (day: number) => {
    if (!date) return false
    return (
      date.getDate() === day &&
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    )
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear()
    )
  }

  const handleSelect = (day: number) => {
    const selected = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    )
    onSelect(selected)
  }

  const days = []
  for (let i = 0; i < adjustedFirstDay; i++) {
    days.push(<div key={`empty-${i}`} />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(
      <button
        key={day}
        onClick={() => handleSelect(day)}
        className={cn(
          'h-9 w-9 rounded-md text-sm font-medium transition-colors hover:bg-accent',
          isSelected(day) && 'bg-primary text-primary-foreground hover:bg-primary',
          isToday(day) && !isSelected(day) && 'bg-accent',
        )}
      >
        {day}
      </button>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'MM/dd/yyyy', { locale: enUS }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {format(currentMonth, 'MMMM yyyy', { locale: enUS })}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>
          <div className="grid grid-cols-7 gap-1">{days}</div>
          <div className="mt-3 pt-3 border-t flex justify-between">
            <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>
              Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const today = new Date()
              setCurrentMonth(today)
              onSelect(today)
            }}>
              Today
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface DateRangePickerProps {
  from?: Date
  to?: Date
  onSelect: (range: { from?: Date; to?: Date }) => void
  className?: string
}

export function DateRangePicker({ from, to, onSelect, className }: DateRangePickerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DatePicker
        date={from}
        onSelect={(date) => onSelect({ from: date, to })}
        placeholder="Start date"
        className="w-36"
      />
      <span className="text-muted-foreground">→</span>
      <DatePicker
        date={to}
        onSelect={(date) => onSelect({ from, to: date })}
        placeholder="End date"
        className="w-36"
      />
    </div>
  )
}
