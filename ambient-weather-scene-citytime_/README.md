# Ambient Sky — Live Weather Scene

A full-screen animated weather scene powered by live weather data through a Node.js/Express backend.

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:4000

## City-local time fix

The scene now uses the selected location's local UTC offset and local weather time. Searching a city updates its weather, clock, and sun/moon day-night animation to that city's local time instead of the computer's local time.
