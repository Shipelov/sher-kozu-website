# Bitrix24 Email Sending via REST API

## Method: crm.activity.add (TYPE_ID=4 for email)

This requires:
1. A CRM contact to exist (OWNER_ID + OWNER_TYPE_ID=3)
2. A responsible employee (RESPONSIBLE_ID)
3. Contact's email in COMMUNICATIONS array

This is **CRM-bound** — sends email on behalf of an employee to a CRM contact.
NOT suitable for transactional OTP emails to arbitrary addresses.

## Alternative approach: Use the built-in notification/LLM service

The project already has `notifyOwner` which sends notifications to the project owner.
But we need to send emails to arbitrary user addresses.

## Best practical approach for OTP delivery:
Since Bitrix24 REST API doesn't have a simple transactional email endpoint,
the most reliable approach is:

1. **Use a dedicated email service** — but user wants Bitrix24
2. **Use Bitrix24 crm.activity.add** — requires contact to exist first, complex
3. **Use the built-in Forge API** — check if it has email sending capability
4. **Use Nodemailer with SMTP** — need SMTP credentials

## Decision:
- Check if the Forge API (BUILT_IN_FORGE_API_URL) has email sending
- If not, use Nodemailer with a free SMTP service or ask user for SMTP credentials
- As fallback, show OTP code on screen for testing (dev mode)
