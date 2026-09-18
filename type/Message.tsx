export type MessageType = {
    id: string,
    role: "user" | "agent" | "assistant",
    content: string,
    time: string
}