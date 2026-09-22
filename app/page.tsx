"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronRight,
  Command,
  Cpu,
  DatabaseZap,
  FileCheck2,
  Gauge,
  GitBranch,
  Globe2,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  MousePointer2,
  Orbit,
  Play,
  PlugZap,
  Radar,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navItems = ["Platform", "Agents", "Automations", "Security"];

const stats = [
  { value: "24/7", label: "recurring runs" },
  { value: "80+", label: "task actions" },
  { value: "0", label: "manual repeats" },
];

const featureCards = [
  {
    title: "Plan, browse, and act",
    description:
      "Orbit breaks goals into visible steps, opens tools, gathers context, and keeps the next action clear.",
    icon: Route,
    className: "lg:col-span-2",
    accent: "bg-cyan-500",
  },
  {
    title: "Native agent workspace",
    description:
      "Chat, task state, files, schedules, and the live desktop stay in one quiet command center.",
    icon: Layers3,
    className: "lg:row-span-2",
    accent: "bg-emerald-500",
  },
  {
    title: "Routine automation",
    description:
      "Turn repeat work into scheduled runs with execution history and human checkpoints.",
    icon: CalendarClock,
    className: "",
    accent: "bg-amber-500",
  },
  {
    title: "Tool intelligence",
    description:
      "Suggests the right connected tools as the task evolves, then uses them with auditable context.",
    icon: PlugZap,
    className: "",
    accent: "bg-rose-500",
  },
  {
    title: "Secure memory layer",
    description:
      "Keep preferences, agent configuration, and run history available without burying teams in setup.",
    icon: LockKeyhole,
    className: "lg:col-span-2",
    accent: "bg-violet-500",
  },
];

const workflowSteps = [
  {
    title: "Describe the outcome",
    text: "Give Orbit a goal, attach context, or start from an existing routine.",
    icon: MessageSquareText,
  },
  {
    title: "Watch the plan form",
    text: "The agent maps tools, dependencies, and checks before it starts acting.",
    icon: BrainCircuit,
  },
  {
    title: "Approve key moves",
    text: "Review sensitive actions, scheduled work, and external tool changes.",
    icon: FileCheck2,
  },
  {
    title: "Ship the result",
    text: "Every run leaves a clean trail of outputs, decisions, and next steps.",
    icon: Check,
  },
];

const integrations = [
  "Browser",
  "Calendar",
  "Email",
  "Database",
  "Desktop VM",
  "Workflows",
  "Files",
  "APIs",
];

const faqs = [
  {
    question: "Can Orbit run recurring agent tasks?",
    answer:
      "Yes. Routines can be scheduled, tracked, and reviewed with execution history so repeat work stays visible.",
  },
  {
    question: "Does this replace the workspace app?",
    answer:
      "No. The landing page points users into the existing workspace where agents, tools, chats, and schedules live.",
  },
  {
    question: "Is it built for teams or solo operators?",
    answer:
      "Both. The page presents Orbit as a lightweight command center for individuals, founders, and operational teams.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-neutral-950">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f7f7f4]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Orbit home">
            <span className="grid size-9 place-items-center rounded-lg bg-neutral-950 text-white">
              <Orbit className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Orbit</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-medium text-neutral-600 transition hover:text-neutral-950"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-black/5 hover:text-neutral-950 sm:inline-flex"
            >
              Sign in
            </Link>
            <Button
              size="lg"
              className="h-10 bg-neutral-950 px-4 text-white hover:bg-neutral-800"
              render={<Link href="/workspace" />}
            >
              Launch
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-black/10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <Badge className="mb-6 h-7 w-fit border border-black/10 bg-white text-neutral-800 shadow-sm" variant="outline">
              <Sparkles className="size-3.5 text-cyan-600" />
              Recurring AI agent bots
            </Badge>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-neutral-950 sm:text-6xl lg:text-7xl">
              Automate the tasks users repeat every day.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600">
              Orbit lets users create AI agent bots that remember instructions, run on a schedule, use connected tools, and report back when recurring work is done.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-neutral-950 px-5 text-base text-white hover:bg-neutral-800"
                render={<Link href="/workspace" />}
              >
                Create recurring agent
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-black/15 bg-white px-5 text-base hover:bg-neutral-100"
                render={<a href="#platform" />}
              >
                <Play data-icon="inline-start" className="size-4" />
                See how it runs
              </Button>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-3 border-y border-black/10">
              {stats.map((stat) => (
                <div key={stat.label} className="py-4 pr-4">
                  <div className="text-2xl font-semibold text-neutral-950">{stat.value}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-black/10 bg-neutral-950 p-3 shadow-2xl shadow-black/20">
            <div className="flex h-full flex-col rounded-md border border-white/10 bg-[#101113]">
              <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-rose-400" />
                  <span className="size-3 rounded-full bg-amber-400" />
                  <span className="size-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300">
                  <Command className="size-3.5" />
                  orbit.agent/run
                </div>
              </div>

              <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Bot className="size-4 text-cyan-300" />
                        Recurring Task Bot
                      </div>
                      <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200" variant="outline">
                        live
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {["Check new user requests", "Update the daily tracker", "Send completion summary"].map((task, index) => (
                        <div key={task} className="flex items-center gap-3 rounded-md bg-black/20 p-3">
                          <span className="grid size-6 place-items-center rounded-md bg-white/10 text-xs text-white">
                            {index + 1}
                          </span>
                          <span className="text-sm text-neutral-300">{task}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                      <Radar className="size-4 text-amber-300" />
                      Tool routing
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {integrations.slice(0, 6).map((item) => (
                        <div key={item} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-neutral-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-white/10 bg-[#e9f5f2] p-4 text-neutral-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                          Current mission
                        </div>
                        <h2 className="mt-2 text-xl font-semibold tracking-normal">
                          Run my weekday customer follow-up routine
                        </h2>
                      </div>
                      <MousePointer2 className="size-5 text-emerald-700" />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {["Tasks", "Done", "Review"].map((label, index) => (
                        <div key={label} className="rounded-md bg-white p-3 shadow-sm">
                          <div className="text-lg font-semibold">{index === 0 ? "18" : index === 1 ? "72%" : "3"}</div>
                          <div className="text-xs text-neutral-500">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                      <Gauge className="mb-4 size-5 text-cyan-300" />
                      <div className="text-sm font-medium text-white">Run health</div>
                      <div className="mt-4 h-2 rounded-full bg-white/10">
                        <div className="h-2 w-[82%] rounded-full bg-cyan-300" />
                      </div>
                      <div className="mt-3 text-xs text-neutral-400">82% complete</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                      <ShieldCheck className="mb-4 size-5 text-emerald-300" />
                      <div className="text-sm font-medium text-white">Approval gate</div>
                      <div className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
                        Waiting on final publish
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid size-9 place-items-center rounded-md bg-cyan-300 text-neutral-950">
                        <Zap className="size-4" />
                      </div>
                      <div>
                      <div className="text-sm font-medium text-white">Next recurring action</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-400">
                          Check inbox at 9:00 AM, summarize new leads, and update the user dashboard.
                      </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mb-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Badge className="mb-4 border-black/10 bg-white text-neutral-700" variant="outline">
              <Cpu className="size-3.5 text-emerald-600" />
              Platform
            </Badge>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-normal sm:text-5xl">
              A minimal command surface for capable agents.
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-neutral-600">
            Every panel is designed for scanning: what the agent knows, what it is doing, and what it needs from you.
          </p>
        </div>

        <div className="grid auto-rows-[minmax(220px,auto)] gap-4 lg:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className={`group rounded-lg border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 ${feature.className}`}
              >
                <div className="flex h-full flex-col">
                  <div className="mb-8 flex items-center justify-between">
                    <span className={`grid size-11 place-items-center rounded-lg ${feature.accent} text-white`}>
                      <Icon className="size-5" />
                    </span>
                    <ChevronRight className="size-5 text-neutral-300 transition group-hover:translate-x-1 group-hover:text-neutral-950" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-normal">{feature.title}</h3>
                  <p className="mt-3 max-w-xl leading-7 text-neutral-600">{feature.description}</p>
                  <div className="mt-auto pt-8">
                    <div className="h-px w-full bg-black/10" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="agents" className="border-y border-black/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24">
          <div>
            <Badge className="mb-4 border-black/10 bg-[#f7f7f4] text-neutral-700" variant="outline">
              <Workflow className="size-3.5 text-cyan-600" />
              Agents
            </Badge>
            <h2 className="text-3xl font-semibold tracking-normal sm:text-5xl">
              From prompt to repeatable operation.
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-neutral-600">
              Orbit makes agent behavior legible. You get clear planning, tool execution, human review points, and durable records for each run.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-lg border border-black/10 bg-[#f7f7f4] p-5">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-neutral-950 text-white">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-semibold text-neutral-400">0{index + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="automations" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-black/10 bg-neutral-950 p-6 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Badge className="border-white/10 bg-white/10 text-white" variant="outline">
                  <DatabaseZap className="size-3.5 text-amber-300" />
                  Automations
                </Badge>
                <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-normal sm:text-5xl">
                  Schedule routines without losing the thread.
                </h2>
              </div>
              <Globe2 className="hidden size-10 text-cyan-200 sm:block" />
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {["Daily lead research", "Weekly report draft", "Incident summary"].map((routine, index) => (
                <div key={routine} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{routine}</span>
                    <span className="size-2 rounded-full bg-emerald-300" />
                  </div>
                  <div className="text-2xl font-semibold">{index === 0 ? "06:30" : index === 1 ? "Mon" : "Live"}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-neutral-500">
                    {index === 2 ? "triggered" : "scheduled"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="security" className="rounded-lg border border-black/10 bg-white p-6">
            <Badge className="border-black/10 bg-[#f7f7f4] text-neutral-700" variant="outline">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Security
            </Badge>
            <h2 className="mt-5 text-3xl font-semibold tracking-normal">Human control stays close.</h2>
            <div className="mt-6 space-y-3">
              {[
                "Approval gates for external changes",
                "Run history for every agent task",
                "Workspace-first authentication",
                "Tool status and disconnect controls",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-black/10 bg-[#f7f7f4] p-3">
                  <span className="grid size-7 place-items-center rounded-md bg-emerald-600 text-white">
                    <Check className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-neutral-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <Badge className="mb-4 border-black/10 bg-[#f7f7f4] text-neutral-700" variant="outline">
                <GitBranch className="size-3.5 text-rose-600" />
                Connected work
              </Badge>
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Built for the tools agents already need.
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {integrations.map((item) => (
                <div key={item} className="rounded-lg border border-black/10 bg-[#f7f7f4] px-4 py-5 text-center text-sm font-semibold text-neutral-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-black/10 bg-white p-6 lg:col-span-2">
            <Search className="mb-8 size-6 text-cyan-600" />
            <blockquote className="max-w-3xl text-2xl font-semibold leading-snug tracking-normal sm:text-3xl">
              “Orbit makes agent work feel operational instead of experimental. The run trail is the difference between a clever demo and something I can trust.”
            </blockquote>
            <div className="mt-8 text-sm font-medium text-neutral-500">Ops lead, early platform team</div>
          </div>
          <div className="rounded-lg border border-black/10 bg-[#e9f5f2] p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">Signal</div>
            <div className="mt-6 text-6xl font-semibold tracking-normal">3.4x</div>
            <p className="mt-4 leading-7 text-neutral-700">
              Faster handoff from task request to reviewed output when routines and tools are kept in one place.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <Badge className="mb-4 border-black/10 bg-[#f7f7f4] text-neutral-700" variant="outline">
              <Sparkles className="size-3.5 text-amber-600" />
              FAQ
            </Badge>
            <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">Quick answers.</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-lg border border-black/10 bg-[#f7f7f4] p-5">
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-2 leading-7 text-neutral-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Orbit className="size-4" />
              Orbit AI Agent Bot Platform
            </div>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-normal sm:text-5xl">
              Give your next agent a place to work.
            </h2>
          </div>
          <Button
            size="lg"
            className="h-12 bg-white px-5 text-base text-neutral-950 hover:bg-neutral-200"
            render={<Link href="/workspace" />}
          >
            Open workspace
            <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      </section>
    </main>
  );
}
