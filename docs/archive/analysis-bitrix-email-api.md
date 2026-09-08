# Bitrix24 Email Sending via crm.activity.add

## Key API Call Structure

To send email via Bitrix24 CRM:

1. **Create contact first** via `crm.contact.add` (or find existing via `crm.contact.list`)
2. **Get employee data** via `user.get` (for RESPONSIBLE_ID and MESSAGE_FROM)
3. **Send email** via `crm.activity.add` with:

```js
crm.activity.add({
  fields: {
    SUBJECT: "subject email now",
    DESCRIPTION: "body email now",
    DESCRIPTION_TYPE: 3,  // 1=plain, 2=HTML, 3=BB-code
    COMPLETED: "Y",
    DIRECTION: 2,  // 2 = outgoing
    OWNER_ID: contactID,  // Bitrix24 contact ID
    OWNER_TYPE_ID: 3,  // 3 = contact
    TYPE_ID: 4,  // 4 = email
    COMMUNICATIONS: [
      {
        VALUE: contactEmail.VALUE,  // email address
        ENTITY_ID: contactID,
        ENTITY_TYPE_ID: 3  // contact
      }
    ],
    START_TIME: new Date().toISOString(),
    END_TIME: new Date(Date.now() + 3600 * 1000).toISOString(),
    RESPONSIBLE_ID: staff.ID,
    SETTINGS: {
      MESSAGE_FROM: `${staff.NAME} ${staff.LAST_NAME} <${staff.EMAIL}>`
    }
  }
});
```

## Implementation Plan for OTP via Bitrix24

1. On registration: create contact in Bitrix24 via `crm.contact.add` with NAME, LAST_NAME, EMAIL, PHONE
2. Store `bitrix24ContactId` in users table
3. To send OTP: use `crm.activity.add` with TYPE_ID=4, DESCRIPTION_TYPE=2 (HTML), 
   DIRECTION=2 (outgoing), COMPLETED=Y
4. Need RESPONSIBLE_ID - use webhook user ID from BITRIX24_REST_USER_ID env var

## Current Bitrix24 Integration (bitrix24.ts)
- Uses webhook URL: `${BITRIX24_BASE_URL}/rest/${BITRIX24_REST_USER_ID}/${BITRIX24_WEBHOOK_TOKEN}`
- Already has `callBitrix24` helper function
- Already creates leads via `crm.lead.add`
- Need to add: `crm.contact.add`, `crm.contact.list`, `crm.activity.add`
