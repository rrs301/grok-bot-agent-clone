"use client"

import {
  BotIcon,
  ChevronUpIcon,
  LoaderCircleIcon,
  LogOutIcon,
  PlusIcon,
  StoreIcon,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import Image from "next/image"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import axios from "axios"
import { AgentConfigType } from "@/type/Agent"
import { usePathname } from "next/navigation"



function AppSidebar() {
  const [agents, setAgents] = useState<AgentConfigType[]>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { data } = useSession();
  const path = usePathname();

  const userInitials = data?.user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  useEffect(() => {
    GetUserAgents()
  }, [path]);

  const GetUserAgents = async () => {
    const result = await axios.get('/api/agent');
    console.log(result.data);
    setAgents(result.data);
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/sign-in" });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-4 px-3 py-4">
        <div className="flex items-center gap-2.5 px-1">
          <Image src="/logo.png" alt="logo" width={45} height={45} />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xl font-semibold leading-none tracking-normal">
              Orbit
            </p>
          </div>
        </div>

        <Link href="/workspace/create-agent">
          <Button size="lg" className="h-10 w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0">
            <PlusIcon className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">
              Create New Agent
            </span>
          </Button>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2">
          <SidebarGroupLabel>Your Agents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {agents?.map((agent, index) => (
                <Link href={'/workspace/' + agent.agentId}>
                  <SidebarMenuItem key={agent.name}>
                    <SidebarMenuButton
                      className="h-10 gap-2.5 rounded-lg"
                      isActive={index === 0}
                      tooltip={agent.name}
                    >
                      <Avatar size="sm" className="size-6">
                        <AvatarImage src={agent?.agentImage} alt={agent.name} />
                        <AvatarFallback>{agent?.agentImage}</AvatarFallback>
                      </Avatar>
                      <span>{agent.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </Link>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-9 gap-2 rounded-lg"
              tooltip="Marketplace"
            >
              <StoreIcon className="size-4" />
              <span>Marketplace</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="mx-0" />

        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                aria-label="Open user menu"
              />
            }
          >
            <Avatar className="size-8">
              <AvatarImage
                src={data?.user?.image ?? ''}
                alt={data?.user?.name ?? 'User'}
              />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium leading-none">
                {data?.user?.name}
              </p>
              <p className="mt-1 truncate text-xs text-sidebar-foreground/60">
                {data?.user?.email}
              </p>
            </div>
            <ChevronUpIcon className="size-4 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-60 gap-2 p-2"
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">
                {data?.user?.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {data?.user?.email}
              </p>
            </div>
            <div className="h-px bg-border" />
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isSigningOut}
              onClick={handleSignOut}
            >
              {isSigningOut ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <LogOutIcon className="size-4" />
              )}
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
