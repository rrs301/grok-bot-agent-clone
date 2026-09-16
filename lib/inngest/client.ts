import { Inngest } from 'inngest';

// Create an Inngest client to send and receive events
export const inngest = new Inngest({
  id: 'fastnext-app',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
