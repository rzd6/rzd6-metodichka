"use client"

import { LecturesSection } from "./lectures-section"
import { TrainingSection } from "./training-section"
import { EventsSection } from "./events-section"
import { ExamsSection } from "./exams-section"
import { InterviewsSection } from "./interviews-section"
import { ReportsSection } from "./reports-section"
import { OrdersSection } from "./orders-section"
import { ReportCompilerSection } from "./report-compilers-section"
import { ContentsSection } from "./contents-section"
import { AdminSection } from "./admin-section"
import { GovWaveSection } from "./gov-wave-section"
import { InformationSection } from "./information-section"
import { DutySection } from "./duty-section"
import { RadioReportsSection } from "./radio-reports-section"
import { ReportGenerationSection } from "./report-generation-section"
import { RetroTrainSection } from "./retro-train-section"
import { RZDWebsiteSection } from "./rzd-website-section"
import { BugReportSection } from "./bug-report-section"
import { TrainScheduleSection } from "./train-schedule-section"
import { BugReportButton } from "@/components/bug-report-button"
import type { UserRole } from "@/data/users"

const SECTION_LABELS: Record<string, string> = {
  contents: "Содержание",
  information: "Информация",
  lectures: "Лекции",
  training: "Тренировки",
  events: "Мероприятия",
  exams: "Экзамены",
  interviews: "Собеседования",
  "retro-train": "Ретропоезд",
  duty: "Дежурство",
  orders: "Приказы",
  "reports-section": "Доклады в рацию",
  "gov-wave": "Гос. волна",
  "report-generation": "Генерация отчётов",
  "report-compiler": "Составитель докладов",
  "rzd-website": "Официальные уведомления",
  "train-schedule": "Расписание рейсов",
  admin: "Управление",
  "bug-report": "Баг-репорт",
}

interface ContentSectionProps {
  activeSection: string
  onSectionChange: (section: string) => void
  userRole?: UserRole
  userNickname?: string
}

function SectionWrapper({ activeSection, children }: { activeSection: string; children: React.ReactNode }) {
  const label = SECTION_LABELS[activeSection] || activeSection
  // Bug-report section renders its own button in its header
  const showButton = activeSection !== "bug-report"
  return (
    <div className="relative">
      {showButton && (
        <div className="absolute top-0 right-0 z-10">
          <BugReportButton sectionLabel={label} />
        </div>
      )}
      {children}
    </div>
  )
}

export function ContentSection({ activeSection, onSectionChange, userRole, userNickname }: ContentSectionProps) {
  const inner = (() => {
    switch (activeSection) {
      case "information":
        return <InformationSection userRole={userRole} />
      case "duty":
        return <DutySection />
      case "reports-section":
        return <RadioReportsSection userRole={userRole} />
      case "contents":
        return <ContentsSection onSectionChange={onSectionChange} userRole={userRole || "ЦдУД"} />
      case "lectures":
        return <LecturesSection />
      case "training":
        return <TrainingSection />
      case "events":
        return <EventsSection />
      case "exams":
        return <ExamsSection />
      case "interviews":
        return <InterviewsSection />
      case "retro-train":
        return <RetroTrainSection />
      case "reports":
        return <ReportsSection />
      case "orders":
        return <OrdersSection />
      case "gov-wave":
        return <GovWaveSection />
      case "report-compiler":
        return <ReportCompilerSection />
      case "admin":
        return <AdminSection />
      case "report-generation":
        return <ReportGenerationSection />
      case "rzd-website":
        return <RZDWebsiteSection userRole={userRole || "ЦдУД"} userNickname={userNickname} />
      case "train-schedule":
        return <TrainScheduleSection userRole={userRole || "ЦдУД"} userNickname={userNickname} />
      case "bug-report":
        return <BugReportSection />
      default:
        return <InformationSection userRole={userRole} />
    }
  })()

  return <SectionWrapper activeSection={activeSection}>{inner}</SectionWrapper>
}
