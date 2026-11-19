// Real materials for bodies (BIM). Like a material in the big BIM tools,
// each one carries more than a look: who it is (identity: name, class, the
// standard its grade comes from), how it shows (a colour, see-through for
// glass), and its technical data - physical (density, stiffness, strength)
// and thermal (conductivity, specific heat, expansion). A body's mass, the
// technical sheet and the drawings' parts list are worked out from them.
//
// Values: strengths are the minimums the named standard gives the grade,
// where it has one; the rest are typical values for the material. Thermal
// values for building materials are the ISO 10456 design values. A supplier's
// own data sheet comes first wherever it differs.

import type { MaterialDef, ProjectDoc } from "../doc/types";
import { trim, UNIT_LABEL, UNIT_MM, units } from "../units";

export const MATERIAL_CLASSES = ["Metal", "Plastic", "Composite", "Concrete & masonry", "Wood", "Glass & stone", "Ceramic & other", "Insulation & boards"] as const;

export const MATERIALS: MaterialDef[] = [
  // ---- Metals
  { id: "steel-s235", name: "Structural steel S235JR", category: "Metal", standard: "EN 10025-2", color: "#8f959c", density: 7850, youngs: 210, poisson: 0.3, yield: 235, tensile: 360, expansion: 12, conductivity: 53, specificHeat: 440 },
  { id: "steel-s355", name: "Structural steel S355J2", category: "Metal", standard: "EN 10025-2", color: "#888e96", density: 7850, youngs: 210, poisson: 0.3, yield: 355, tensile: 470, expansion: 12, conductivity: 53, specificHeat: 440 },
  { id: "ss-304", name: "Stainless steel 1.4301 (304)", category: "Metal", standard: "EN 10088-2", color: "#b8bec5", density: 7900, youngs: 200, poisson: 0.3, yield: 210, tensile: 520, expansion: 16, conductivity: 15, specificHeat: 500 },
  { id: "ss-316", name: "Stainless steel 1.4401 (316)", category: "Metal", standard: "EN 10088-2", color: "#b3b9c0", density: 8000, youngs: 200, poisson: 0.3, yield: 220, tensile: 520, expansion: 16, conductivity: 15, specificHeat: 500 },
  { id: "al-6061", name: "Aluminium EN AW-6061-T6", category: "Metal", standard: "EN 755-2", color: "#c9ced4", density: 2700, youngs: 70, poisson: 0.3, yield: 240, tensile: 260, expansion: 23, conductivity: 167, specificHeat: 896 },
  { id: "al-6082", name: "Aluminium EN AW-6082-T6", category: "Metal", standard: "EN 1999-1-1", color: "#c4c9cf", density: 2700, youngs: 70, poisson: 0.3, yield: 260, tensile: 310, expansion: 23, conductivity: 170, specificHeat: 900 },
  { id: "cast-iron", name: "Grey cast iron EN-GJL-250", category: "Metal", standard: "EN 1561", color: "#5d6066", density: 7200, youngs: 110, poisson: 0.26, tensile: 250, expansion: 11, conductivity: 48, specificHeat: 460 },
  { id: "brass", name: "Brass CW614N (CuZn39Pb3)", category: "Metal", standard: "EN 12164", color: "#c9a64e", density: 8470, youngs: 96, poisson: 0.34, yield: 250, tensile: 430, expansion: 21, conductivity: 113, specificHeat: 377 },
  { id: "copper", name: "Copper Cu-ETP (CW004A)", category: "Metal", standard: "EN 13601", color: "#b87333", density: 8930, youngs: 117, poisson: 0.34, yield: 70, tensile: 200, expansion: 17, conductivity: 390, specificHeat: 385 },
  { id: "ti-5", name: "Titanium Grade 5 (Ti-6Al-4V)", category: "Metal", standard: "ASTM B348", color: "#8c8e91", density: 4430, youngs: 114, poisson: 0.34, yield: 828, tensile: 895, expansion: 8.6, conductivity: 6.7, specificHeat: 526 },
  { id: "steel-c45", name: "Carbon steel C45 (1045)", category: "Metal", standard: "EN 10083-2", color: "#868c93", density: 7850, youngs: 210, poisson: 0.29, yield: 340, tensile: 620, expansion: 11.5, conductivity: 50, specificHeat: 486 },
  { id: "steel-42crmo4", name: "Alloy steel 42CrMo4 (4140), quenched & tempered", category: "Metal", standard: "EN 10083-3", color: "#7f858c", density: 7850, youngs: 210, poisson: 0.29, yield: 650, tensile: 900, expansion: 12.3, conductivity: 42.6, specificHeat: 473 },
  { id: "tool-d2", name: "Tool steel 1.2379 (D2)", category: "Metal", standard: "ISO 4957", color: "#73797f", density: 7700, youngs: 210, poisson: 0.3, expansion: 10.5, conductivity: 20, specificHeat: 460 },
  { id: "ss-303", name: "Stainless steel 1.4305 (303)", category: "Metal", standard: "EN 10088-3", color: "#bac0c7", density: 7900, youngs: 193, poisson: 0.29, yield: 190, tensile: 500, expansion: 17.3, conductivity: 16.2, specificHeat: 500 },
  { id: "ss-17-4", name: "Stainless steel 1.4542 (17-4 PH), H900", category: "Metal", standard: "EN 10088-3", color: "#a9afb6", density: 7780, youngs: 197, poisson: 0.27, yield: 1170, tensile: 1310, expansion: 10.8, conductivity: 18.3, specificHeat: 460 },
  { id: "ductile-iron", name: "Ductile iron EN-GJS-400-15", category: "Metal", standard: "EN 1563", color: "#63666c", density: 7100, youngs: 169, poisson: 0.275, yield: 250, tensile: 400, expansion: 12.5, conductivity: 36, specificHeat: 515 },
  { id: "al-5052", name: "Aluminium EN AW-5052-H32", category: "Metal", standard: "EN 485-2", color: "#ccd1d7", density: 2680, youngs: 70, poisson: 0.33, yield: 193, tensile: 228, expansion: 23.8, conductivity: 138, specificHeat: 880 },
  { id: "al-7075", name: "Aluminium EN AW-7075-T6", category: "Metal", standard: "EN 755-2", color: "#c2c7cd", density: 2810, youngs: 71.7, poisson: 0.33, yield: 503, tensile: 572, expansion: 23.6, conductivity: 130, specificHeat: 960 },
  { id: "al-2024", name: "Aluminium EN AW-2024-T3", category: "Metal", standard: "EN 485-2", color: "#c0c5cb", density: 2780, youngs: 73.1, poisson: 0.33, yield: 345, tensile: 483, expansion: 23.2, conductivity: 121, specificHeat: 875 },
  { id: "al-cast", name: "Cast aluminium EN AC-46500 (A380)", category: "Metal", standard: "EN 1706", color: "#b7bcc2", density: 2760, youngs: 71, poisson: 0.33, yield: 160, tensile: 324, expansion: 21.8, conductivity: 96, specificHeat: 963 },
  { id: "bronze", name: "Phosphor bronze CuSn8 (CW453K)", category: "Metal", standard: "EN 1652", color: "#b0884a", density: 8800, youngs: 115, poisson: 0.34, yield: 260, tensile: 390, expansion: 17, conductivity: 67, specificHeat: 380 },
  { id: "ti-2", name: "Titanium Grade 2 (commercially pure)", category: "Metal", standard: "ASTM B348", color: "#96989b", density: 4510, youngs: 105, poisson: 0.37, yield: 275, tensile: 345, expansion: 8.6, conductivity: 16.4, specificHeat: 523 },
  { id: "mg-az31", name: "Magnesium AZ31B", category: "Metal", standard: "ASTM B90", color: "#a7aaa8", density: 1770, youngs: 45, poisson: 0.35, yield: 200, tensile: 260, expansion: 26, conductivity: 96, specificHeat: 1000 },
  { id: "zamak3", name: "Zinc die-cast Zamak 3 (ZP3)", category: "Metal", standard: "EN 12844", color: "#a3a7ad", density: 6600, youngs: 96, poisson: 0.27, yield: 208, tensile: 283, expansion: 27.4, conductivity: 113, specificHeat: 419 },
  { id: "inconel-718", name: "Nickel alloy 718", category: "Metal", standard: "ASTM B637", color: "#9a9c98", density: 8190, youngs: 200, poisson: 0.29, yield: 1035, tensile: 1240, expansion: 13, conductivity: 11.4, specificHeat: 435 },
  { id: "lead", name: "Lead", category: "Metal", color: "#6e7279", density: 11340, youngs: 16, poisson: 0.44, tensile: 18, expansion: 29, conductivity: 35, specificHeat: 128 },
  { id: "tungsten", name: "Tungsten", category: "Metal", color: "#7d7f82", density: 19300, youngs: 411, poisson: 0.28, expansion: 4.5, conductivity: 173, specificHeat: 134 },
  { id: "gold", name: "Gold (fine)", category: "Metal", color: "#d4af37", density: 19300, youngs: 79, poisson: 0.42, tensile: 120, expansion: 14.2, conductivity: 318, specificHeat: 129 },
  { id: "silver", name: "Silver (fine)", category: "Metal", color: "#c9cbcd", density: 10490, youngs: 83, poisson: 0.37, tensile: 140, expansion: 18.9, conductivity: 429, specificHeat: 235 },
  // ---- Plastics (typical values; a printed part is weaker than a moulded one)
  { id: "pla", name: "PLA", category: "Plastic", color: "#e9e4d8", density: 1240, youngs: 3.5, poisson: 0.36, tensile: 50, expansion: 68, conductivity: 0.13, specificHeat: 1800 },
  { id: "petg", name: "PETG", category: "Plastic", color: "#cfe3e8", opacity: 0.85, density: 1270, youngs: 2, tensile: 50, conductivity: 0.2 },
  { id: "abs", name: "ABS", category: "Plastic", color: "#d9d4c7", density: 1050, youngs: 2.3, poisson: 0.35, tensile: 40, expansion: 90, conductivity: 0.17, specificHeat: 1400 },
  { id: "pa6", name: "Nylon PA6 (dry)", category: "Plastic", color: "#e8e2d0", density: 1140, youngs: 3, tensile: 80, expansion: 80, conductivity: 0.25, specificHeat: 1700 },
  { id: "pc", name: "Polycarbonate (PC)", category: "Plastic", color: "#dfe8ee", opacity: 0.6, density: 1200, youngs: 2.4, poisson: 0.37, yield: 62, tensile: 65, expansion: 70, conductivity: 0.2, specificHeat: 1200 },
  { id: "pmma", name: "Acrylic (PMMA)", category: "Plastic", color: "#e3f1f3", opacity: 0.4, density: 1190, youngs: 3.2, poisson: 0.37, tensile: 70, expansion: 70, conductivity: 0.19, specificHeat: 1470 },
  { id: "pom", name: "Acetal (POM)", category: "Plastic", color: "#f1efe9", density: 1410, youngs: 2.9, tensile: 65, expansion: 110, conductivity: 0.31, specificHeat: 1470 },
  { id: "epdm", name: "Rubber (EPDM)", category: "Plastic", standard: "ISO 10456", color: "#2e2f31", density: 1150, conductivity: 0.25, specificHeat: 1000 },
  { id: "asa", name: "ASA", category: "Plastic", color: "#d6d2c8", density: 1070, youngs: 2, tensile: 45, expansion: 95, conductivity: 0.17, specificHeat: 1300 },
  { id: "tpu", name: "TPU (flexible, Shore 95A)", category: "Plastic", color: "#d9dde0", density: 1210, tensile: 35, conductivity: 0.2, specificHeat: 1800 },
  { id: "resin-sla", name: "Photopolymer resin (SLA, standard)", category: "Plastic", note: "Typical cured values; each resin's data sheet differs", color: "#c9ccd0", density: 1180, youngs: 2.8, tensile: 60, conductivity: 0.2 },
  { id: "pa12", name: "Nylon PA12", category: "Plastic", note: "Printed (SLS) parts are lighter: about 950 kg/m³", color: "#ecebe6", density: 1010, youngs: 1.7, tensile: 48, expansion: 110, conductivity: 0.23, specificHeat: 1700 },
  { id: "pa66", name: "Nylon PA66 (dry)", category: "Plastic", color: "#ebe5d4", density: 1140, youngs: 3, poisson: 0.39, tensile: 85, expansion: 80, conductivity: 0.25, specificHeat: 1700 },
  { id: "hdpe", name: "Polyethylene HDPE", category: "Plastic", color: "#f0efea", density: 950, youngs: 1, poisson: 0.42, yield: 26, tensile: 30, expansion: 120, conductivity: 0.48, specificHeat: 1900 },
  { id: "ldpe", name: "Polyethylene LDPE", category: "Plastic", color: "#f2f1ec", opacity: 0.85, density: 920, youngs: 0.25, tensile: 10, expansion: 200, conductivity: 0.33, specificHeat: 2300 },
  { id: "pp", name: "Polypropylene (PP)", category: "Plastic", color: "#ece9e0", density: 905, youngs: 1.5, poisson: 0.42, yield: 32, tensile: 33, expansion: 100, conductivity: 0.22, specificHeat: 1920 },
  { id: "pet", name: "PET", category: "Plastic", color: "#d8e8ec", opacity: 0.7, density: 1380, youngs: 2.8, poisson: 0.38, tensile: 55, expansion: 70, conductivity: 0.24, specificHeat: 1100 },
  { id: "pvc", name: "PVC (rigid)", category: "Plastic", color: "#d5d7d9", density: 1400, youngs: 3, poisson: 0.38, tensile: 50, expansion: 70, conductivity: 0.17, specificHeat: 900 },
  { id: "ptfe", name: "PTFE", category: "Plastic", color: "#f4f3ef", density: 2200, youngs: 0.5, poisson: 0.46, tensile: 25, expansion: 120, conductivity: 0.25, specificHeat: 1000 },
  { id: "peek", name: "PEEK", category: "Plastic", color: "#c9b48e", density: 1300, youngs: 3.6, poisson: 0.4, tensile: 100, expansion: 47, conductivity: 0.25, specificHeat: 1340 },
  { id: "hips", name: "Polystyrene (HIPS)", category: "Plastic", color: "#efeeea", density: 1040, youngs: 2, tensile: 26, expansion: 80, conductivity: 0.17, specificHeat: 1300 },
  { id: "epoxy", name: "Epoxy resin (cast)", category: "Plastic", color: "#d9c78f", opacity: 0.7, density: 1200, youngs: 3, poisson: 0.35, tensile: 60, expansion: 60, conductivity: 0.2, specificHeat: 1100 },
  { id: "silicone", name: "Silicone rubber", category: "Plastic", color: "#d8d4cc", density: 1150, tensile: 7, conductivity: 0.2, specificHeat: 1300 },
  { id: "natural-rubber", name: "Natural rubber", category: "Plastic", color: "#3a3631", density: 930, tensile: 20, expansion: 220, conductivity: 0.13, specificHeat: 1900 },
  // ---- Composites (in the plane of the layers; across them far less)
  { id: "cfrp", name: "Carbon fibre / epoxy (quasi-isotropic)", category: "Composite", color: "#2b2d30", density: 1600, youngs: 70, poisson: 0.3, tensile: 600, expansion: 2, conductivity: 5, specificHeat: 1000 },
  { id: "gfrp", name: "Glass fibre / epoxy (woven)", category: "Composite", color: "#d9d6c4", density: 1900, youngs: 25, poisson: 0.28, tensile: 350, expansion: 12, conductivity: 0.35, specificHeat: 900 },
  // ---- Concrete and masonry
  { id: "concrete-c25", name: "Concrete C25/30", category: "Concrete & masonry", standard: "EN 1992-1-1", color: "#a3a29d", density: 2400, youngs: 31, poisson: 0.2, compressive: 25, tensile: 2.6, expansion: 10, conductivity: 2, specificHeat: 1000 },
  { id: "concrete-c30-rc", name: "Reinforced concrete C30/37 (1 % steel)", category: "Concrete & masonry", standard: "EN 1992-1-1", color: "#9c9b96", density: 2500, youngs: 33, poisson: 0.2, compressive: 30, tensile: 2.9, expansion: 10, conductivity: 2.3, specificHeat: 1000 },
  { id: "brick", name: "Clay brickwork (outer leaf)", category: "Concrete & masonry", color: "#a55a3f", density: 1700, conductivity: 0.77, specificHeat: 800 },
  { id: "concrete-c40", name: "Concrete C40/50", category: "Concrete & masonry", standard: "EN 1992-1-1", color: "#a6a5a0", density: 2400, youngs: 35, poisson: 0.2, compressive: 40, tensile: 3.5, expansion: 10, conductivity: 2, specificHeat: 1000 },
  { id: "aac", name: "Aerated concrete block (AAC)", category: "Concrete & masonry", color: "#e2e0da", density: 500, compressive: 4, conductivity: 0.13, specificHeat: 1000 },
  // ---- Wood
  { id: "c24", name: "Softwood C24", category: "Wood", standard: "EN 338", color: "#d8b77e", density: 420, youngs: 11, bending: 24, tensile: 14.5, compressive: 21, expansion: 5, conductivity: 0.12, specificHeat: 1600 },
  { id: "d30", name: "Hardwood D30 (oak)", category: "Wood", standard: "EN 338", color: "#a97a4c", density: 640, youngs: 11, bending: 30, tensile: 18, compressive: 24, expansion: 5, conductivity: 0.18, specificHeat: 1600 },
  { id: "plywood", name: "Plywood", category: "Wood", standard: "ISO 10456", color: "#cfa86f", density: 500, conductivity: 0.13, specificHeat: 1600 },
  { id: "gl24h", name: "Glulam GL24h", category: "Wood", standard: "EN 14080", color: "#d9b97f", density: 420, youngs: 11.5, bending: 24, tensile: 19.2, compressive: 24, expansion: 5, conductivity: 0.12, specificHeat: 1600 },
  // (Species: typical values at 12 % moisture, along the grain.)
  { id: "pine", name: "Pine", category: "Wood", color: "#ddbd85", density: 520, youngs: 12, expansion: 5, conductivity: 0.13, specificHeat: 1600 },
  { id: "spruce", name: "Spruce", category: "Wood", color: "#e3c995", density: 450, youngs: 10, expansion: 5, conductivity: 0.12, specificHeat: 1600 },
  { id: "beech", name: "Beech", category: "Wood", color: "#d2a77a", density: 720, youngs: 14, expansion: 5, conductivity: 0.17, specificHeat: 1600 },
  { id: "birch", name: "Birch", category: "Wood", color: "#e0c69d", density: 670, youngs: 14, expansion: 5, conductivity: 0.15, specificHeat: 1600 },
  { id: "maple", name: "Maple (hard)", category: "Wood", color: "#e6cfa6", density: 705, youngs: 12.6, expansion: 5, conductivity: 0.16, specificHeat: 1600 },
  { id: "ash", name: "Ash", category: "Wood", color: "#dbc296", density: 680, youngs: 12.3, expansion: 5, conductivity: 0.16, specificHeat: 1600 },
  { id: "walnut", name: "Walnut", category: "Wood", color: "#6b4a33", density: 610, youngs: 11.6, expansion: 5, conductivity: 0.14, specificHeat: 1600 },
  { id: "cherry", name: "Cherry", category: "Wood", color: "#a0603f", density: 560, youngs: 10.3, expansion: 5, conductivity: 0.13, specificHeat: 1600 },
  { id: "mahogany", name: "Mahogany", category: "Wood", color: "#80422e", density: 590, youngs: 10, expansion: 5, conductivity: 0.13, specificHeat: 1600 },
  { id: "teak", name: "Teak", category: "Wood", color: "#a87a45", density: 650, youngs: 12.3, expansion: 5, conductivity: 0.15, specificHeat: 1600 },
  { id: "balsa", name: "Balsa", category: "Wood", color: "#ead9b4", density: 160, youngs: 3.7, conductivity: 0.05, specificHeat: 1600 },
  { id: "bamboo", name: "Bamboo", category: "Wood", color: "#d9c28a", density: 700, youngs: 17, conductivity: 0.17, specificHeat: 1600 },
  { id: "mdf", name: "MDF", category: "Wood", color: "#b99a74", density: 750, youngs: 3.5, conductivity: 0.14, specificHeat: 1700 },
  { id: "chipboard", name: "Particle board (chipboard)", category: "Wood", standard: "ISO 10456", color: "#c8a878", density: 600, conductivity: 0.14, specificHeat: 1700 },
  { id: "osb", name: "OSB", category: "Wood", standard: "ISO 10456", color: "#c69e62", density: 650, conductivity: 0.13, specificHeat: 1700 },
  // ---- Glass and stone
  { id: "glass", name: "Float glass (soda-lime)", category: "Glass & stone", standard: "EN 572-1", color: "#bfdde0", opacity: 0.3, density: 2500, youngs: 70, poisson: 0.2, bending: 45, expansion: 9, conductivity: 1, specificHeat: 720 },
  { id: "granite", name: "Granite", category: "Glass & stone", standard: "ISO 10456", color: "#8b8580", density: 2700, conductivity: 2.8, specificHeat: 1000 },
  { id: "glass-tempered", name: "Toughened glass", category: "Glass & stone", standard: "EN 12150-1", color: "#bcdade", opacity: 0.3, density: 2500, youngs: 70, poisson: 0.2, bending: 120, expansion: 9, conductivity: 1, specificHeat: 720 },
  { id: "borosilicate", name: "Borosilicate glass", category: "Glass & stone", color: "#cfe6e8", opacity: 0.3, density: 2230, youngs: 64, poisson: 0.2, expansion: 3.3, conductivity: 1.14, specificHeat: 830 },
  { id: "marble", name: "Marble", category: "Glass & stone", standard: "ISO 10456", color: "#e7e4de", density: 2800, conductivity: 3.5, specificHeat: 1000 },
  { id: "limestone", name: "Limestone (hard)", category: "Glass & stone", standard: "ISO 10456", color: "#d8cfb8", density: 2200, conductivity: 1.7, specificHeat: 1000 },
  { id: "sandstone", name: "Sandstone", category: "Glass & stone", standard: "ISO 10456", color: "#cdb48a", density: 2600, conductivity: 2.3, specificHeat: 1000 },
  { id: "slate", name: "Slate", category: "Glass & stone", standard: "ISO 10456", color: "#4f5559", density: 2400, conductivity: 2.2, specificHeat: 1000 },
  // ---- Ceramics and the rest
  { id: "alumina", name: "Alumina ceramic (99.5 %)", category: "Ceramic & other", color: "#f1efe8", density: 3890, youngs: 370, poisson: 0.22, compressive: 2600, bending: 379, expansion: 8.1, conductivity: 30, specificHeat: 880 },
  { id: "porcelain", name: "Porcelain", category: "Ceramic & other", color: "#f3f2ee", density: 2400, youngs: 70, expansion: 6, conductivity: 1.5, specificHeat: 1085 },
  { id: "cardboard", name: "Cardboard", category: "Ceramic & other", color: "#b8946a", density: 700, conductivity: 0.07, specificHeat: 1400 },
  { id: "leather", name: "Leather", category: "Ceramic & other", color: "#8a5a3b", density: 860, tensile: 20, conductivity: 0.16, specificHeat: 1500 },
  // ---- Insulation and boards
  { id: "plasterboard", name: "Gypsum plasterboard", category: "Insulation & boards", standard: "ISO 10456", color: "#ece9e2", density: 900, conductivity: 0.25, specificHeat: 1000 },
  { id: "mineral-wool", name: "Mineral wool", category: "Insulation & boards", color: "#d8c27a", density: 30, conductivity: 0.035, specificHeat: 1030 },
  { id: "eps", name: "Expanded polystyrene (EPS)", category: "Insulation & boards", color: "#f3f3f0", density: 20, conductivity: 0.035, specificHeat: 1450 },
  { id: "xps", name: "Extruded polystyrene (XPS)", category: "Insulation & boards", color: "#9fc3e0", density: 35, conductivity: 0.034, specificHeat: 1450 },
  { id: "pir", name: "PIR foam board", category: "Insulation & boards", color: "#e6d9a8", density: 30, conductivity: 0.022, specificHeat: 1400 },
  { id: "glass-wool", name: "Glass wool", category: "Insulation & boards", color: "#e7d38a", density: 20, conductivity: 0.035, specificHeat: 1030 },
  { id: "wood-fibre", name: "Wood fibre insulation", category: "Insulation & boards", color: "#b8925e", density: 160, conductivity: 0.04, specificHeat: 2100 },
  { id: "cork", name: "Cork board", category: "Insulation & boards", standard: "ISO 10456", color: "#a87b52", density: 120, conductivity: 0.04, specificHeat: 1560 },
];

/** Every material the project can use: the library, and its own. */
export function allMaterials(doc: ProjectDoc): MaterialDef[] {
  return [...MATERIALS, ...(doc.customMaterials ?? [])];
}

/** The material given to a body (undefined: none yet). */
export function materialOf(doc: ProjectDoc, body: string): MaterialDef | undefined {
  const id = doc.materials?.[body];
  return id ? allMaterials(doc).find((m) => m.id === id) : undefined;
}

/** The technical data of a material, as rows to show: [label, value with its unit]. Only what it has. */
export function materialRows(m: MaterialDef): { group: string; rows: [string, string][] }[] {
  const n = (v: number) => String(Math.round(v * 1000) / 1000);
  const row = (label: string, v: number | undefined, unit: string): [string, string][] => (v === undefined ? [] : [[label, `${n(v)} ${unit}`.trim()]]);
  const groups = [
    { group: "Identity", rows: [["Class", m.category], ...(m.standard ? [["Standard", m.standard]] : []), ...(m.note ? [["Note", m.note]] : [])] as [string, string][] },
    {
      group: "Physical",
      rows: [
        ...row("Density", m.density, "kg/m³"),
        ...row("Young's modulus", m.youngs, "GPa"),
        ...row("Poisson's ratio", m.poisson, ""),
        ...row("Yield strength", m.yield, "MPa"),
        ...row("Tensile strength", m.tensile, "MPa"),
        ...row("Compressive strength", m.compressive, "MPa"),
        ...row("Bending strength", m.bending, "MPa"),
      ],
    },
    {
      group: "Thermal",
      rows: [...row("Thermal conductivity", m.conductivity, "W/(m·K)"), ...row("Specific heat", m.specificHeat, "J/(kg·K)"), ...row("Thermal expansion", m.expansion, "µm/(m·K)")],
    },
  ];
  return groups.filter((g) => g.rows.length);
}

/** Mass in kg of `volumeMM3` cubic millimetres of it. */
export function massOf(m: MaterialDef, volumeMM3: number): number {
  return volumeMM3 * 1e-9 * m.density;
}

/** A mass for people: g under a kilo, kg up to a tonne, t above. */
export function fmtMass(kg: number): string {
  if (kg < 1) return `${trim(kg * 1000, 1)} g`;
  if (kg < 1000) return `${trim(kg, 3)} kg`;
  return `${trim(kg / 1000, 3)} t`;
}

export function fmtVolume(mm3: number): string {
  const k = UNIT_MM[units()];
  return `${trim(mm3 / (k * k * k), 3)} ${UNIT_LABEL[units()]}³`;
}

export function fmtArea(mm2: number): string {
  const k = UNIT_MM[units()];
  return `${trim(mm2 / (k * k), 3)} ${UNIT_LABEL[units()]}²`;
}

/** Give bodies a material (its colour, and see-through for glass, come with it); null takes it away. */
export function assignMaterial(d: ProjectDoc, bodies: string[], m: MaterialDef | null): void {
  const materials = { ...(d.materials ?? {}) };
  const colors = { ...(d.colors ?? {}) };
  const opacity = { ...(d.opacity ?? {}) };
  for (const b of bodies) {
    if (!m) {
      delete materials[b];
      continue;
    }
    materials[b] = m.id;
    colors[b] = m.color;
    if (m.opacity !== undefined) opacity[b] = m.opacity;
    else delete opacity[b];
  }
  d.materials = materials;
  d.colors = colors;
  d.opacity = opacity;
}
