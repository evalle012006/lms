import { loadSettingsSystemDate } from "@/lib/graph.functions";

export async function register() {
    const date = await loadSettingsSystemDate();
    console.log('running on system date:', date.toLocaleDateString({} as any, { timeZone: 'Asia/Manila' }));
}

