import { buildProfile } from "../../services/profileBuilder.js";
import { resolveUserById } from "../../db/repositories/users.js";
import { enqueueJob } from "../../db/repositories/jobs.js";

export async function handleUpdateProfile(payload: unknown) {
	const { userId } = payload as { userId: string };
	await buildProfile(userId);

	// A fresh profile means the homepage is stale — queue an enriched rebuild.
	// Deduped on external id, so concurrent profile updates don't stack builds.
	const user = await resolveUserById(userId);
	if (!user) return;
	await enqueueJob(
		"build_homepage",
		{ externalId: user.externalId },
		user.externalId,
	);
}
