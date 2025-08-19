"use client";

import React, { useMemo, useState } from "react";

// Zevero Basic Footprint Calculator (React/TSX)
// ---------------------------------------------------------------------------------
// Updates in this revision:
// - Intensity confirmed as per FTE.
// - Scope 2 now shows BOTH market-based and location-based calculations.
// - Added unit tests for market- vs location-based electricity.
// ---------------------------------------------------------------------------------

// ------- Utilities -------
const numberOrZero = (v: string | number) => {
  const n = typeof v === "number" ? v : parseFloat(v || "");
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const approxEqual = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

// --- Default factors & mappings (PLACEHOLDERS — replace with platform factors) ---
const ELECTRICITY_INTENSITY_KWH_M2 = 200; // kWh/m²/year
const HEATING_INTENSITY_KWH_M2 = 165; // kWh/m²/year

// Grid emission factors (kgCO2e/kWh). Placeholder values.
const GRID_FACTORS: Record<string, number> = {
  "United Kingdom": 0.18,
  "United States": 0.40,
  Germany: 0.35,
  France: 0.07,
  Spain: 0.20,
  Netherlands: 0.35,
  Australia: 0.70,
  India: 0.70,
  China: 0.65,
  Japan: 0.45,
  Brazil: 0.09,
  Canada: 0.12,
  "South Africa": 0.90,
};

const COUNTRY_LIST = Object.keys(GRID_FACTORS).sort();

// Heating source emission factors (kgCO2e/kWh). Placeholder values.
const HEATING_FACTORS: Record<string, number> = {
  Electricity: 0.0, // counted in Scope 2 (avoid double-counting here)
  "Natural gas": 0.184,
  "Fuel oil": 0.267,
  Biomass: 0.0, // often treated as biogenic
  "District heating": 0.200,
  "Not sure": 0.184, // conservative assumption
};

// Renewable electricity market-based modifier
const RENEWABLE_FACTOR: Record<string, number> = {
  Yes: 0,
  No: 1,
  "Not sure": 1,
};

// Remote work commute modifier
const REMOTE_MODIFIER: Record<string, number> = {
  "Yes, fully": 0,
  Hybrid: 0.5,
  "No, mostly in-office": 1,
};

// Fleet & commuting emission factor per km (kgCO2e/km) default
const EF_KG_PER_KM_DEFAULT = 0.192; // placeholder (e.g., DEFRA avg car)

// Flights (kgCO2e per round-trip) including RFI uplift — placeholders
const FLIGHT_FACTORS = {
  short: 300,
  medium: 1100,
  long: 3000,
};

// ------- Pure calculation helpers (exported for testability) -------
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

export function computeFleetEmissionsKg(numVehicles: number, kmPerVehicle: number, efKgPerKm: number) {
  return numVehicles * kmPerVehicle * efKgPerKm;
}

export function computeFlightsEmissionsKg(shortTrips: number, mediumTrips: number, longTrips: number) {
  return shortTrips * FLIGHT_FACTORS.short + mediumTrips * FLIGHT_FACTORS.medium + longTrips * FLIGHT_FACTORS.long;
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

export function computeEquipmentEmissionsKg(laptops: number, desktops: number, monitors: number) {
  return laptops * 250 + desktops * 600 + monitors * 100;
}

// ------- Simple embedded unit tests (console) -------
function runUnitTests() {
  const results: { name: string; ok: boolean; got: number; expected: number }[] = [];

  const t1 = computeElectricityEmissionsKg(100, 0.5, 1, 200); // 100*200=20000 kWh *0.5=10000 kg
  results.push({ name: "Electricity emissions (location)", ok: approxEqual(t1, 10000), got: t1, expected: 10000 });

  const t1b = computeElectricityEmissionsKg(100, 0.5, 0, 200); // market-based fully green => 0
  results.push({ name: "Electricity emissions (market, 100% green)", ok: approxEqual(t1b, 0), got: t1b, expected: 0 });

  const t2 = computeHeatingEmissionsKg(100, 0.2, 165); // 100*165=16500 *0.2=3300
  results.push({ name: "Heating emissions", ok: approxEqual(t2, 3300), got: t2, expected: 3300 });

  const t3 = computeFleetEmissionsKg(2, 10000, 0.2); // 2*10000*0.2=4000
  results.push({ name: "Fleet emissions", ok: approxEqual(t3, 4000), got: t3, expected: 4000 });

  const t4 = computeFlightsEmissionsKg(1, 2, 3); // 1*300 + 2*1100 + 3*3000 = 11500
  results.push({ name: "Flights emissions", ok: approxEqual(t4, 11500), got: t4, expected: 11500 });

  const t5 = computeCommuteEmissionsKg(10, 50, 0.2, 1); // commuters=5; 5*30*220*0.2=6600
  results.push({ name: "Commute emissions", ok: approxEqual(t5, 6600), got: t5, expected: 6600 });

  const t6 = computeEquipmentEmissionsKg(1, 1, 1); // 250+600+100=950
  results.push({ name: "Equipment emissions", ok: approxEqual(t6, 950), got: t6, expected: 950 });

  // Log concise summary for devs
  const passed = results.filter(r => r.ok).length;
  // eslint-disable-next-line no-console
  console.log(`[Tests] ${passed}/${results.length} passed`, results);

  return { passed, total: results.length, results };
}

// ------- UI building blocks -------
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl shadow-sm border p-5 mb-6 bg-white">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function InputNumber({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  label: string;
  value: number | string;
  onChange: (n: number) => void;
  min?: number;
  step?: number | "any";
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(numberOrZero(e.target.value))}
        />
        {suffix ? <span className="text-sm text-gray-500 min-w-[2ch]">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <select
        className="rounded-xl border px-3 py-2 focus:outline-none focus:ring bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ZeveroFootprintCalculator() {
  // Run tests once per mount (results shown in UI)
  const [{ passed, total, results: testResults }] = useState(runUnitTests());

  // Core inputs
  const [fte, setFte] = useState(50);
  const [country, setCountry] = useState("United Kingdom");
  const [officeArea, setOfficeArea] = useState(1000); // m²

  const [greenElec, setGreenElec] = useState<"Yes" | "No" | "Not sure">("Not sure");
  const [heatingSource, setHeatingSource] = useState<keyof typeof HEATING_FACTORS>("Natural gas");

  const [numVehicles, setNumVehicles] = useState(0);
  const [kmPerVehicle, setKmPerVehicle] = useState(12000);
  const [efPerKm, setEfPerKm] = useState(EF_KG_PER_KM_DEFAULT);

  const [flightsShort, setFlightsShort] = useState(0);
  const [flightsMedium, setFlightsMedium] = useState(0);
  const [flightsLong, setFlightsLong] = useState(0);

  const [pctCommuteCar, setPctCommuteCar] = useState(50);
  const [remoteStatus, setRemoteStatus] = useState<keyof typeof REMOTE_MODIFIER>("Hybrid");

  const [numLaptop, setNumLaptop] = useState(50);
  const [numDesktop, setNumDesktop] = useState(0);
  const [numMonitor, setNumMonitor] = useState(60);

  // Derived factors
  const gridEF = GRID_FACTORS[country] ?? 0.4; // kgCO2e/kWh (fallback)
  const renewableFactor = RENEWABLE_FACTOR[greenElec];
  const heatingEF = HEATING_FACTORS[heatingSource];
  const remoteMod = REMOTE_MODIFIER[remoteStatus];

  // Scope 2 electricity: market- vs location-based (all kgCO2e)
  const scope2MarketKg = useMemo(
    () => computeElectricityEmissionsKg(officeArea, gridEF, renewableFactor),
    [officeArea, gridEF, renewableFactor]
  );
  const scope2LocationKg = useMemo(
    () => computeElectricityEmissionsKg(officeArea, gridEF, 1),
    [officeArea, gridEF]
  );

  // Other calculations (all kgCO2e)
  const heatingEmissionsKg = useMemo(
    () => computeHeatingEmissionsKg(officeArea, heatingEF),
    [officeArea, heatingEF]
  );
  const fleetEmissionsKg = useMemo(
    () => computeFleetEmissionsKg(numVehicles, kmPerVehicle, efPerKm),
    [numVehicles, kmPerVehicle, efPerKm]
  );
  const flightsEmissionsKg = useMemo(
    () => computeFlightsEmissionsKg(flightsShort, flightsMedium, flightsLong),
    [flightsShort, flightsMedium, flightsLong]
  );
  const commuteEmissionsKg = useMemo(
    () => computeCommuteEmissionsKg(fte, pctCommuteCar, efPerKm, remoteMod),
    [fte, pctCommuteCar, efPerKm, remoteMod]
  );
  const equipEmissionsKg = useMemo(
    () => computeEquipmentEmissionsKg(numLaptop, numDesktop, numMonitor),
    [numLaptop, numDesktop, numMonitor]
  );

  const scope1Kg = fleetEmissionsKg + heatingEmissionsKg;
  const scope3Kg = flightsEmissionsKg + commuteEmissionsKg + equipEmissionsKg;

  // Totals (kg & t), both reporting bases
  const totalMarketKg = scope1Kg + scope2MarketKg + scope3Kg;
  const totalMarketT = totalMarketKg / 1000;
  const totalLocationKg = scope1Kg + scope2LocationKg + scope3Kg;
  const totalLocationT = totalLocationKg / 1000;

  // Intensities (per FTE)
  const perFteMarketKg = fte > 0 ? totalMarketKg / fte : 0;
  const perFteMarketT = perFteMarketKg / 1000;
  const perFteLocationKg = fte > 0 ? totalLocationKg / fte : 0;
  const perFteLocationT = perFteLocationKg / 1000;

  const format = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

  const resetAll = () => {
    setFte(50);
    setCountry("United Kingdom");
    setOfficeArea(1000);
    setGreenElec("Not sure");
    setHeatingSource("Natural gas");
    setNumVehicles(0);
    setKmPerVehicle(12000);
    setEfPerKm(EF_KG_PER_KM_DEFAULT);
    setFlightsShort(0);
    setFlightsMedium(0);
    setFlightsLong(0);
    setPctCommuteCar(50);
    setRemoteStatus("Hybrid");
    setNumLaptop(50);
    setNumDesktop(0);
    setNumMonitor(60);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Zevero – Basic Carbon Footprint Calculator</h1>
          <p className="text-gray-600 mt-1">
            Quick estimation across Scope 1, 2 (market & location), and selected Scope 3 categories. Replace
            placeholder factors with Zevero datasets for production use.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-xl border hover:bg-gray-50" onClick={resetAll}>Reset to defaults</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left side: Inputs/Calcs */}
        <div>
          <Section title="Company & Location">
            <Row>
              <InputNumber label="How many full-time equivalent (FTE) employees?" value={fte} onChange={setFte} step={1} />
              <Select label="Where is your company headquartered?" value={country} onChange={setCountry} options={COUNTRY_LIST} />
            </Row>
            <div className="text-xs text-gray-500 mt-2">Grid emission factor (kgCO₂e/kWh): {format(gridEF)}</div>
          </Section>

          <Section title="Office & Energy" subtitle="Estimates Scope 1 & 2 from area and default intensities">
            <Row>
              <InputNumber label="Office surface area" value={officeArea} onChange={setOfficeArea} step={1} suffix="m²" />
              <Select label="Do you purchase 100% renewable electricity? (Market-based)" value={greenElec} onChange={(v) => setGreenElec(v as any)} options={["Yes", "No", "Not sure"]} />
              <Select label="Primary heating source (Scope 1)" value={heatingSource} onChange={(v) => setHeatingSource(v as keyof typeof HEATING_FACTORS)} options={["Electricity", "Natural gas", "Fuel oil", "Biomass", "District heating", "Not sure"]} />
            </Row>
          </Section>

          <Section title="Fleet & Travel">
            <Row>
              <InputNumber label="# company vehicles" value={numVehicles} onChange={setNumVehicles} step={1} />
              <InputNumber label="Avg km per vehicle per year" value={kmPerVehicle} onChange={setKmPerVehicle} step={100} suffix="km" />
              <InputNumber label="Emission factor per km (fleet/commute)" value={efPerKm} onChange={setEfPerKm} step="any" suffix="kg/km" />
            </Row>

            <Row>
              <InputNumber label="Short-haul flights (<1.5h) per year" value={flightsShort} onChange={setFlightsShort} step={1} />
              <InputNumber label="Medium-haul flights (1.5–4h) per year" value={flightsMedium} onChange={setFlightsMedium} step={1} />
              <InputNumber label="Long-haul flights (>4h) per year" value={flightsLong} onChange={setFlightsLong} step={1} />
            </Row>
          </Section>

          <Section title="Commuting & Work Mode">
            <Row>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">% of employees commuting by car</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pctCommuteCar}
                  onChange={(e) => setPctCommuteCar(numberOrZero(e.target.value))}
                />
                <div className="text-sm text-gray-600">{pctCommuteCar}%</div>
              </label>
              <Select label="Do your employees work remotely?" value={remoteStatus} onChange={(v) => setRemoteStatus(v as keyof typeof REMOTE_MODIFIER)} options={["Yes, fully", "Hybrid", "No, mostly in-office"]} />
            </Row>
          </Section>

          <Section title="IT Equipment (Purchased Goods)">
            <Row>
              <InputNumber label="Laptops" value={numLaptop} onChange={setNumLaptop} step={1} />
              <InputNumber label="Desktops" value={numDesktop} onChange={setNumDesktop} step={1} />
              <InputNumber label="Monitors" value={numMonitor} onChange={setNumMonitor} step={1} />
            </Row>
          </Section>

          <Section title="Embedded Unit Tests">
            <div className="text-sm">{passed}/{total} tests passed.</div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-700">Show test details</summary>
              <ul className="mt-2 list-disc ml-6 text-xs">
                {testResults.map((t, i) => (
                  <li key={i} className={t.ok ? "text-emerald-700" : "text-red-700"}>
                    {t.name}: got {t.got.toFixed(2)}, expected {t.expected.toFixed(2)} — {t.ok ? "OK" : "FAIL"}
                  </li>
                ))}
              </ul>
            </details>
          </Section>
        </div>

        {/* Right side: Results */}
        <div>
          <Section title="Results" subtitle="All figures annualised; Scope 2 shows market- and location-based">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-emerald-50 border p-4">
                <div className="text-sm text-emerald-900">Scope 1</div>
                <div className="text-2xl font-semibold">{format(scope1Kg / 1000)} tCO₂e</div>
                <div className="text-xs text-emerald-900 mt-1">{format(scope1Kg)} kg</div>
              </div>

              <div className="rounded-xl bg-blue-50 border p-4">
                <div className="text-sm text-blue-900">Scope 2 (Electricity)</div>
                <div className="text-lg font-semibold">Market-based: {format(scope2MarketKg / 1000)} tCO₂e</div>
                <div className="text-xs text-blue-900 mt-1">{format(scope2MarketKg)} kg</div>
                <div className="border-t my-2"></div>
                <div className="text-lg font-semibold">Location-based: {format(scope2LocationKg / 1000)} tCO₂e</div>
                <div className="text-xs text-blue-900 mt-1">{format(scope2LocationKg)} kg</div>
              </div>

              <div className="rounded-xl bg-purple-50 border p-4">
                <div className="text-sm text-purple-900">Scope 3</div>
                <div className="text-2xl font-semibold">{format(scope3Kg / 1000)} tCO₂e</div>
                <div className="text-xs text-purple-900 mt-1">{format(scope3Kg)} kg</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl border p-4 bg-gray-50">
                <div className="text-sm text-gray-700">Total (Market-based)</div>
                <div className="text-3xl font-bold">{format(totalMarketT)} tCO₂e / year</div>
                <div className="text-xs text-gray-600 mt-1">{format(totalMarketKg)} kgCO₂e</div>
                <div className="text-xs text-gray-600 mt-1">Intensity (per FTE): {fte > 0 ? `${format(perFteMarketKg)} kg / FTE` : "N/A"}</div>
                <div className="text-xs text-gray-500">That’s {fte > 0 ? `${format(perFteMarketT)} t / FTE` : "N/A"} per year.</div>
              </div>

              <div className="rounded-2xl border p-4 bg-gray-50">
                <div className="text-sm text-gray-700">Total (Location-based)</div>
                <div className="text-3xl font-bold">{format(totalLocationT)} tCO₂e / year</div>
                <div className="text-xs text-gray-600 mt-1">{format(totalLocationKg)} kgCO₂e</div>
                <div className="text-xs text-gray-600 mt-1">Intensity (per FTE): {fte > 0 ? `${format(perFteLocationKg)} kg / FTE` : "N/A"}</div>
                <div className="text-xs text-gray-500">That’s {fte > 0 ? `${format(perFteLocationT)} t / FTE` : "N/A"} per year.</div>
              </div>
            </div>
          </Section>
        </div>
      </div>

      <footer className="mt-6 text-xs text-gray-500">
        Heating via electricity is excluded from Scope 1 to avoid double counting with Scope 2.
        Replace placeholder factors with Zevero datasets before production use.
      </footer>
    </div>
  );
}
