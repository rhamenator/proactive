# Troubleshooting

## I Cannot Log In To The Dashboard

Check:

- you are using an admin account
- your password is correct
- the backend API is running
- the dashboard is pointing at the correct API URL

## I Cannot Log In To The Mobile App

Check:

- you are using a canvasser account
- your turf has been assigned
- the device can reach the backend when online

## My Turf Does Not Appear On Mobile

Check:

- the admin assigned the turf to your account
- you are signed in with the correct canvasser account
- the app has refreshed after login

## My Visit Did Not Sync

Check:

- whether the device is online
- whether the visit is still shown in the queue
- whether the backend is reachable from the device

If the queue remains stuck, keep the device open, reconnect to the network, and retry sync.

## Location Or GPS Problems

Check:

- location permission is allowed
- device-level location services are enabled
- the app has enough signal accuracy outdoors

Low accuracy or missing GPS may still allow local queueing, but the server can flag the record.

## CSV Import Problems

Check:

- the file has address line, city, and state values
- the selected mapping matches the CSV column names
- the file is actually CSV and not spreadsheet-only format

## When To Escalate

Escalate to the internal admin or implementation team if:

- login fails for multiple known-good accounts
- no assigned turf loads for any user
- exports fail repeatedly
- the sync queue does not clear after connectivity returns
- the backend or dashboard is unreachable
