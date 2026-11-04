import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, visitorClient } from "./test-project";
import { createWorld, hours, type World } from "./world";

// Reviews (T30, supabase/migrations/20261104170000_reviews.sql) against the real test project: only the
// booking's customer reviews a completed job, once; anyone reads a service's rating and latest reviews,
// which never carry the customer's name or the agency.

let world: World;

beforeAll(async () => {
  world = await createWorld("t30");
}, 180_000);

afterAll(async () => {
  await world.cleanup();
}, 120_000);

const done = () => world.job({ startsAt: new Date(Date.now() - hours(6)), completed: true });
const review = (client: typeof world.users.customer.client, orderId: string, service = 5, cleaner: number | null = 4, comment = "Rapi sekali.") =>
  client.rpc("submit_review", { p_order: orderId, p_service_rating: service, p_cleaner_rating: cleaner, p_comment: comment });

describe("reviews", { timeout: 30_000 }, () => {
  it("lets the customer review a completed job once, shown on the service without names", async () => {
    const orderId = await done();
    expect((await review(world.users.customer.client, orderId)).error).toBeNull();
    expect((await review(world.users.customer.client, orderId, 1)).error?.message).toBe("review_exists");

    const mine = await world.users.customer.client.rpc("my_reviews");
    expect((mine.data ?? []).find((row: { order_id: string }) => row.order_id === orderId)).toMatchObject({ service_rating: 5, cleaner_rating: 4 });

    const { data } = await visitorClient().rpc("service_reviews", { p_service: world.serviceId });
    expect(data.count).toBe(1);
    expect(Number(data.average)).toBe(5);
    expect(data.latest[0]).toMatchObject({ comment: "Rapi sekali.", cleaner_first_name: "Uji" });
    const text = JSON.stringify(data);
    for (const hidden of ["Uji Pelanggan", "Uji Agensi", world.users.customer.email]) expect(text).not.toContain(hidden);
  });

  it("refuses a job that is not completed, another customer's job, and bad ratings", async () => {
    const upcoming = await world.job({ startsAt: new Date(Date.now() + hours(6)) });
    expect((await review(world.users.customer.client, upcoming)).error?.message).toBe("job_not_found");
    const orderId = await done();
    expect((await review(world.users.otherCustomer.client, orderId)).error?.message).toBe("job_not_found");
    expect((await review(world.users.customer.client, orderId, 6)).error?.message).toBe("rating_invalid");
    expect((await review(world.users.customer.client, orderId, 5, 0)).error?.message).toBe("rating_invalid");
    expect((await review(world.users.customer.client, orderId, 5, 5, "x".repeat(501))).error?.message).toBe("comment_invalid");
    for (const client of [world.users.cleanerA.client, world.users.agencyA.client, world.users.admin.client]) {
      expect((await review(client, orderId)).error?.code).toBe("42501");
    }
  });

  it("keeps the table itself closed", async () => {
    for (const client of [visitorClient(), world.users.customer.client]) {
      expect((await client.from("reviews").select("*")).error?.code).toBe("42501");
    }
    expect((await adminClient().from("reviews").select("order_id").limit(1)).error).toBeNull();
  });
});
