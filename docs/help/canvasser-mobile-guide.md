# Canvasser Mobile Guide

## What The Mobile App Is For

The mobile app is used by canvassers to:

- sign in
- see assigned turf
- start and manage a turf session
- log visit outcomes
- keep working when connectivity is weak or unavailable
- sync pending work later

## Sign In

1. Open the mobile app.
2. Enter your canvasser email and password.
3. Sign in.

Important:

- the mobile app is currently for canvasser accounts only
- admin accounts should use the web dashboard instead

## Before You Start

Make sure:

- your device has battery
- location permission is allowed
- your turf has already been assigned by an admin

## Start A Turf

1. Open the assigned turf.
2. Select `Start`.
3. Allow location access if prompted.

The app records session state and uses location for turf and visit validation.

## Log A Visit

1. Open a household record.
2. Choose the visit result.
3. Add notes if needed.
4. Submit the visit.

If you are offline, the app should keep the visit in the local queue and sync it later.

## Pause Or Resume Work

Use pause when you step away from active canvassing.

1. Select `Pause` when stopping temporarily.
2. Select `Resume` when returning to work.

## Complete A Turf

1. Review remaining addresses.
2. Select `Complete` when finished.
3. Confirm the completion action if prompted.

## Offline Use

The app is designed to keep working with poor connectivity.

Expected behavior:

- visits save locally first
- pending items stay queued on the device
- sync retries when connectivity returns
- you can continue working with cached turf data

## Internal Testing And Side-Loading

For in-org testing:

- iOS testers normally install through TestFlight
- Android testers can install a preview APK directly or use Play Internal Testing

Detailed build/distribution steps:

- [Repo README](../../README.md)
- [Mobile README](../../mobile-app/README.md)

## Good Field Habits

- keep location enabled while canvassing
- sync before ending the day if possible
- do not share accounts
- report repeated login or sync failures to an admin
