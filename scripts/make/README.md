# Make.com Scenario Blueprints

Store exported Make.com scenario JSON blueprints here for reuse across client projects.

## Agency Make Account
- Org ID: `7066630`
- Team ID: `2066652`

## Saved Scenarios

| File | Description | Client |
|---|---|---|
| (export from Make and add here) | | |

## Standard Flows

### 1. New Order Notification
**Trigger:** Google Sheets — Watch New Rows (every 15 min)
**Action:** Gmail — Send Email
**Used in:** Davinchi App (Scenario 4543122)

### 2. Status Change Alert (planned)
**Trigger:** Google Sheets — Watch Changed Rows
**Action:** Gmail or WhatsApp (CallMeBot)

## How to export a blueprint
1. Open scenario in Make.com
2. Click ••• → Export Blueprint
3. Save the JSON file here as `client-name_scenario-name.json`
