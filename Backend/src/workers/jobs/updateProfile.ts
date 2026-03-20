import { buildProfile } from "../../services/profileBuilder.js";

export async function handleUpdateProfile(payload: unknown) {
	const { userId } = payload as { userId: string };
	await buildProfile(userId);
}
