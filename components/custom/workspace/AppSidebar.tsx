"use client"

import {
  BotIcon,
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
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import axios from "axios"
import { AgentConfigType } from "@/type/Agent"
import { usePathname } from "next/navigation"



function AppSidebar() {
  const [agents, setAgents] = useState<AgentConfigType[]>();

  const { data } = useSession();
  const path = usePathname();

  useEffect(() => {
    GetUserAgents()
  }, [path]);

  const GetUserAgents = async () => {
    const result = await axios.get('/api/agent');
    console.log(result.data);
    setAgents(result.data);
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

        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Avatar className="size-8">
            <AvatarImage
              src={data?.user?.image ?? ''}
              alt={data?.user?.name ?? ''}
            />
            <AvatarFallback>RS</AvatarFallback>
          </Avatar>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium leading-none">
              {data?.user?.name}
            </p>
            <p className="mt-1 truncate text-xs text-sidebar-foreground/60">
              {data?.user?.email}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
