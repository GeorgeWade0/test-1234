export const ELECTRICITY_INTENSITY_KWH_M2 = 200; // kWh/m²/year
export const HEATING_INTENSITY_KWH_M2 = 165; // kWh/m²/year

export function computeElectricityEmissionsKg(
  officeAreaM2: number,
  gridEFKgPerKWh: number,
  renewableFactor: number,
  electricityIntensityKwhM2 = ELECTRICITY_INTENSITY_KWH_M2
) {
  const kWh = officeAreaM2 * electricityIntensityKwhM2;
  return kWh * gridEFKgPerKWh * renewableFactor;
}

export function computeHeatingEmissionsKg(
  officeAreaM2: number,
  heatingEFKgPerKWh: number,
  heatingIntensityKwhM2 = HEATING_INTENSITY_KWH_M2
) {
  const kWh = officeAreaM2 * heatingIntensityKwhM2;
  return kWh * heatingEFKgPerKWh;
}

export function computeFleetEmissionsKg(
  numVehicles: number,
  kmPerVehicle: number,
  efKgPerKm: number
) {
  return numVehicles * kmPerVehicle * efKgPerKm;
}

export function computeFlightsEmissionsKg(
  shortTrips: number,
  mediumTrips: number,
  longTrips: number
) {
  return (
    shortTrips * 300 +
    mediumTrips * 1100 +
    longTrips * 3000
  );
}

export function computeCommuteEmissionsKg(
  fte: number,
  pctCommuteCar: number, // 0-100
  efKgPerKm: number,
  remoteModifier: number
) {
  const dailyKm = 30; // round trip assumption
  const workingDays = 220;
  const commuters = fte * (pctCommuteCar / 100);
  return commuters * dailyKm * workingDays * efKgPerKm * remoteModifier;
}

export function computeEquipmentEmissionsKg(
  laptops: number,
  desktops: number,
  monitors: number
) {
  return laptops * 250 + desktops * 600 + monitors * 100;
}

const approxEqual = (a: number, b: number, tol = 1e-6) =>
  Math.abs(a - b) <= tol;

export function runUnitTests() {
  const results: { name: string; ok: boolean; got: number; expected: number }[] = [];

  const t1 = computeElectricityEmissionsKg(100, 0.5, 1, 200); // 100*200*0.5 = 10000
  results.push({ name: "Electricity emissions (location)", ok: approxEqual(t1, 10000), got: t1, expected: 10000 });

  const t1b = computeElectricityEmissionsKg(100, 0.5, 0, 200); // market-based fully green => 0
  results.push({ name: "Electricity emissions (market, 100% green)", ok: approxEqual(t1b, 0), got: t1b, expected: 0 });

  const t2 = computeHeatingEmissionsKg(100, 0.2, 165); // 100*165*0.2 = 3300
  results.push({ name: "Heating emissions", ok: approxEqual(t2, 3300), got: t2, expected: 3300 });

  const t3 = computeFleetEmissionsKg(2, 10000, 0.2); // 2*10000*0.2 = 4000
  results.push({ name: "Fleet emissions", ok: approxEqual(t3, 4000), got: t3, expected: 4000 });

  const t4 = computeFlightsEmissionsKg(1, 2, 3); // 1*300 + 2*1100 + 3*3000 = 11500
  results.push({ name: "Flights emissions", ok: approxEqual(t4, 11500), got: t4, expected: 11500 });

  const t5 = computeCommuteEmissionsKg(10, 50, 0.2, 1); // commuters=5; 5*30*220*0.2=6600
  results.push({ name: "Commute emissions", ok: approxEqual(t5, 6600), got: t5, expected: 6600 });

  const t6 = computeEquipmentEmissionsKg(1, 1, 1); // 250+600+100=950
  results.push({ name: "Equipment emissions", ok: approxEqual(t6, 950), got: t6, expected: 950 });

  const passed = results.filter((r) => r.ok).length;
  console.log(`[Tests] ${passed}/${results.length} passed`, results);
  return { passed, total: results.length, results };
}

