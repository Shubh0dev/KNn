-- Booking requests (stay / table / experience) carry their details in dedicated
-- columns, so their message is optional. General enquiries keep the original
-- 10–2000 character rule. Every existing row is a general enquiry that already
-- satisfies it, so nothing is rewritten.
alter table public.enquiries
  drop constraint enquiries_message_check,
  add constraint enquiries_message_check check (
    char_length(message) <= 2000 and (enquiry_type <> 'general' or char_length(message) >= 10)
  );
