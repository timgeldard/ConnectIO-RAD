// @ts-nocheck
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { Icon, RiskDot } from './Primitives'
import { Card } from './Shared'

const tones = ['slate', 'forest', 'sage', 'sunset', 'sunrise', 'jade'];

const roleCopy = {
  en: {
    site: 'Site Mgr',
    shift: 'Shift Lead',
    dock: 'Dock Lead',
    goodsIn: 'Goods-In Lead',
    qa: 'QA Lead',
    planner: 'Planner',
    dispensary: 'Dispensary Lead',
  },
  fr: {
    site: 'Resp. site',
    shift: "Chef d'équipe",
    dock: 'Resp. quai',
    goodsIn: 'Resp. réception',
    qa: 'Resp. QA',
    planner: 'Planificateur',
    dispensary: 'Resp. dispensaire',
  },
  es: {
    site: 'Resp. sitio',
    shift: 'Jefe de turno',
    dock: 'Resp. muelle',
    goodsIn: 'Resp. recepción',
    qa: 'Resp. QA',
    planner: 'Planificador',
    dispensary: 'Resp. dispensario',
  },
  de: {
    site: 'Standortleitung',
    shift: 'Schichtleitung',
    dock: 'Dockleitung',
    goodsIn: 'Wareneingangsleitung',
    qa: 'QA-Leitung',
    planner: 'Planung',
    dispensary: 'Dosierleitung',
  },
};

const docsCopy = {
  en: {
    problemBody: 'Today a Kerry warehouse manager holds the operational picture in their head plus five tools: SAP GUI, the MII shop-floor dashboard, a Power BI report, WhatsApp, and a paper A3 on the wall.',
    problemBullets: [
      ['Staging decisions are late.', 'Problems surface when the line is already waiting, not 90 minutes before.'],
      ['Exception triage is manual.', 'TR/TO faults, QA holds and short-picks live in three different screens.'],
      ['No shared language.', 'Site managers speak SAP; planners speak product; operators speak bin/line.'],
      ['Mobile supervision is broken.', 'SAP GUI on a tablet is unusable; nobody does it.'],
    ],
    thesisBody: 'Put every operational signal on one screen, keyed to the process order, the delivery or the bin, whichever the user is thinking about right now, and surface risk before it becomes failure.',
    thesisBullets: [
      'Live pull of LTAK/LTAP, LIKP/LIPS, EKKO/EKPO, LQUA into a unified domain model.',
      'Single risk grammar (Critical · At risk · On track) across every screen.',
      'Plain-language labels with SAP IDs on drill-down: hybrid fidelity, not pure SAP.',
      'Works on a 32" control-room monitor, a manager laptop, and a shift lead tablet.',
    ],
    labels: {
      goal: 'Goal:',
      kpis: 'KPIs they own:',
      metric_one: 'metric',
      metric_other: 'metrics',
      clear: 'Clear',
      when: 'When:',
      shownOn: 'Shown on:',
      notifies: 'Notifies:',
      attributes: 'Attributes',
      relations: 'Relations',
      present: 'present',
      todo: 'TODO',
    },
    personas: [
      ['Warehouse user', 'Warehouse Manager', 'WH', 'slate', 'Hit today’s OTIF. No fire-fighting before 08:30 stand-up.', '“I find out about a short-pick when the lorry is at the gate.”', 'OTIF, DIFOT, staging punctuality, stock accuracy'],
      ['Dara Byrne', 'Shift Lead · B', 'DB', 'forest', 'Keep the 4 lines fed. Resolve TR exceptions in under 10 min.', '“I walk 12km a shift chasing pallets that aren’t where SAP says.”', 'Line-fed minutes, TR confirmation time, exceptions cleared / shift'],
      ['Aoife Kelly', 'Dock Lead · Outbound', 'AK', 'sage', 'Zero missed cut-offs. Every trailer loaded right-first-time.', '“Paper pick lists. I can’t see staging progress until it’s too late.”', 'On-time loading, short-pick rate, dock turn time'],
      ['Padraig Ryan', 'Dispensary Lead', 'PR', 'sunset', 'Micros ready before batch start. Zero weigh errors. Traceable.', '“Nobody sees the dispensary queue until something blocks.”', 'Dispensary queue depth, weigh variance, batch pass rate'],
    ],
    principles: [
      ['01', 'Risk first, detail second', 'Every list sorts by operational risk by default. Red, amber, green is a universal grammar across screens.'],
      ['02', 'One object, many lenses', 'A process order appears in Staging, Dispensary, Inventory and Exceptions: the same object, not four records.'],
      ['03', 'Plain language on top, SAP underneath', '"Putaway task" in the UI. TO 0023456 on drill-down. Site managers switch; operators never need to.'],
      ['04', 'Time is a first-class dimension', 'Every row shows ETA, cut-off or start time, and how far we are from it, not just status.'],
      ['05', 'Actionable, not informational', 'Every card answers "what should I do next?" before "what is happening?".'],
      ['06', 'Designed for 32" and 13"', 'Control-tower wall readability at 3 metres; dense table layouts on the manager laptop.'],
    ],
    scopeIn: [
      'Control Tower: shift-level KPIs, live schedule, exception feed, dock board',
      'Production Staging: process orders 24h horizon, staging progress, dispensary link',
      'Inbound: PO + STO receipts, dock assignment, putaway progress',
      'Outbound: deliveries by cut-off, pick/stage/load progress, route/dock view',
      'Inventory & Bins: bin health, line-side stock, batch expiry, stuck HUs',
      'Dispensary workbench: queue, weigh progress, scale/station status',
      'Exceptions command centre: prioritised, assignable, cross-domain',
      'Performance: 14-day rolling KPIs, per-shift / per-line breakdown',
    ],
    scopeOut: [
      'Execution: UI does not post to SAP; read-mostly with assign/acknowledge writes',
      'Operator handhelds (RF): covered by existing SAPConsole',
      'Yard management / gate booking',
      'Planning & MRP: SAP APO remains the authority',
      'Multi-plant roll-up: Naas only at pilot',
      'Predictive models: rule-based risk only in v1',
    ],
    roadmap: [
      ['M0', 'Design partner', 'Q2', 'Naas shift leads co-design. 3 screens shippable.', 'slate'],
      ['M1', 'Pilot: Naas', 'Q3', 'Full v1 scope. Read-only integration. Daily stand-up wall.', 'forest'],
      ['M2', '3-plant EMEA', 'Q4', 'Listowel + Charleville. Multi-plant roll-up.', 'sage'],
      ['M3', 'Global GA', 'Y+1', 'Americas + APAC. Write-back to SAP for acknowledge/assign.', 'sunset'],
    ],
    kpi: {
      eyebrow: 'KPI Catalogue · v0.4 · {{count}} metrics',
      title: 'Every number, its formula, and who owns it.',
      lede: 'These are the KPIs Warehouse Manager 360° computes, displays, and alerts on. Each one has a single formula, a single data source of truth, and a single accountable role, so when a number moves, everyone knows where it came from and who can change it.',
      search: 'Filter by name, formula, source, owner…',
      derived: 'Derived from targets',
      alertTitle: 'Alerting rules',
      columns: ['Metric', 'Formula', 'Target', 'Freq.', 'Source of truth', 'Owner'],
      domains: ['Outbound', 'Production staging', 'Inbound', 'Inventory', 'Dispensary', 'Exceptions'],
      freqs: { shift: 'Shift', daily: 'Daily', live: 'Live', weekly: 'Weekly', batch: 'Batch' },
      names: [
        'OTIF: On Time In Full', 'Dock turn time', 'Short-pick rate', 'Loading on-time', 'Cut-off breach alerts triggered',
        'Staging punctuality', 'Line-fed minutes', 'Average staging lead time', 'Split-pick rate',
        'PO receiving variance', 'Putaway cycle time', 'QA hold turnaround', 'GR-on-time',
        'Stock accuracy (cycle count)', 'Batch expiry ≤ 30d', 'Bin utilisation (bulk)', 'Stuck HU count (> 24h no move)',
        'Weigh variance', 'Queue depth', 'Batch ready-before-start',
        'Mean time to acknowledge', 'Mean time to resolve', 'Re-opened exception rate',
      ],
      formulas: [
        '(deliveries shipped on time ∧ complete) ÷ total deliveries', 'avg(truck depart − truck arrive)', 'pick tasks with qty < requested ÷ pick tasks', 'loads completed ≤ cut-off ÷ loads', 'count(deliveries where pickPct < 80% within 90m of cut-off)',
        '(stages complete ≥ start − 20m) ÷ stages', 'minutes the line had material available ÷ planned run mins', 'stage complete − stage requested', 'TOs that could not be picked from a single HU ÷ TOs',
        '|received − expected| ÷ expected', 'avg(putaway confirmed − GR posted)', 'avg(QA released − QA block posted)', 'receipts with GR posted ≤ ETA + 30m ÷ receipts',
        'bins with |system − actual| ≤ tolerance ÷ bins counted', 'count(LQUA where BBD − now ≤ 30d)', 'Σ occupied bins ÷ Σ bins, storage type 001', 'count(HUs where last move > 24h ∧ status ≠ shipped)',
        '|weighed − target| ÷ target', 'count(batches awaiting weigh)', 'batches where all micros weighed ≥ order start ÷ batches',
        'avg(ack time − raise time)', 'avg(resolve time − raise time)', 'exceptions re-opened within 4h ÷ resolved',
      ],
      alerts: [
        ['Cut-off breach', 'Delivery · pickPct < 80% ∧ cut-off < 90 min', 'Outbound · Control Tower · Exceptions', 'Dock Lead + Site Mgr'],
        ['Staging at risk', 'Process order · staged < 90% ∧ start < 45 min', 'Staging · Control Tower · Exceptions', 'Shift Lead'],
        ['Inbound overdue', 'Receipt · ETA + 30 min ∧ status = Expected', 'Inbound · Control Tower', 'Goods-In Lead'],
        ['QA hold escalation', 'QA hold age > 4h ∧ needed for today batch', 'Inbound · Exceptions', 'QA Lead + Shift Lead'],
        ['Stuck HU', 'HU · last move > 24h ∧ status ≠ shipped', 'Inventory · Exceptions', 'Shift Lead'],
        ['Batch expiry', 'Batch · BBD − now ≤ 14d ∧ onHand > 0', 'Inventory', 'Planner + Site Mgr'],
        ['Dispensary block', 'Batch · micros < 100% ∧ order start < 30 min', 'Dispensary · Staging · Exceptions', 'Dispensary Lead'],
      ],
    },
    data: {
      eyebrow: 'Data Model · v0.4 · 12 core entities',
      title: 'One unified domain model across five SAP modules.',
      lede: 'The UI never exposes SAP tables directly. A lightweight domain layer maps LTAK, LIKP, EKPO, LQUA, LAGP, MCHA and MII scale events into the twelve entities below. Every screen in Warehouse Manager 360° queries this layer, never SAP GUI directly.',
      meta: [['Access', 'Read-mostly · SAP OData + CDS views'], ['Write-back', 'Assign · Acknowledge only (v1)'], ['Cache', '30 s · bin & dispensary live'], ['Latency target', 'p95 ≤ 1.2 s first paint']],
      erTitle: 'Entity relationship',
      erEyebrow: 'Core domain map',
      erSubtitle: 'Hover any entity to see its SAP source. Arrows indicate cardinality.',
      fieldTitle: 'SAP field mapping',
      fieldEyebrow: 'Reference · hybrid fidelity',
      fieldColumns: ['UI label', 'Domain field', 'SAP table · field', 'Notes'],
      sapTitle: 'SAP table availability',
      sapColumns: ['SAP table', 'Description', 'Schema table / TODO'],
      integrationTitle: 'Integration surface',
      integrationEyebrow: 'What talks to what',
    },
  },
  fr: {
    problemBody: "Aujourd'hui, un responsable d'entrepôt Kerry garde la situation opérationnelle en tête, plus cinq outils: SAP GUI, le tableau de bord atelier MII, un rapport Power BI, WhatsApp et un A3 papier au mur.",
    problemBullets: [
      ['Les décisions de préparation arrivent tard.', "Les problèmes apparaissent quand la ligne attend déjà, pas 90 minutes avant."],
      ["Le tri des exceptions est manuel.", "Les défauts TR/TO, blocages QA et ruptures de picking vivent dans trois écrans."],
      ["Pas de langage partagé.", "Les responsables parlent SAP, les planificateurs produit, les opérateurs emplacement/ligne."],
      ["La supervision mobile est cassée.", "SAP GUI sur tablette est inutilisable; personne ne s'en sert."],
    ],
    thesisBody: "Mettre chaque signal opérationnel sur un écran, rattaché à l'ordre process, à la livraison ou à l'emplacement selon la pensée utilisateur, et faire remonter le risque avant l'échec.",
    thesisBullets: [
      'Extraction en direct de LTAK/LTAP, LIKP/LIPS, EKKO/EKPO, LQUA dans un modèle de domaine unifié.',
      'Grammaire de risque unique (Critique · À risque · Dans les temps) sur tous les écrans.',
      'Libellés métier avec identifiants SAP au détail: fidélité hybride, pas SAP pur.',
      'Fonctionne sur écran salle de contrôle 32", ordinateur responsable et tablette chef de quart.',
    ],
    labels: { goal: 'Objectif:', kpis: 'KPI suivis:', metric_one: 'indicateur', metric_other: 'indicateurs', clear: 'Effacer', when: 'Quand:', shownOn: 'Affiché sur:', notifies: 'Notifie:', attributes: 'Attributs', relations: 'Relations', present: 'présents', todo: 'À faire' },
    personas: [
      ['Warehouse user', "Responsable d'entrepôt", 'WH', 'slate', "Atteindre l'OTIF du jour. Pas d'urgence avant le point 08:30.", "« J'apprends une rupture de picking quand le camion est à la porte. »", 'OTIF, DIFOT, ponctualité préparation, exactitude stock'],
      ['Dara Byrne', "Chef d'équipe · B", 'DB', 'forest', 'Garder les 4 lignes alimentées. Résoudre les exceptions TR en moins de 10 min.', "« Je marche 12 km par quart à chercher des palettes qui ne sont pas où SAP les indique. »", 'Minutes ligne alimentée, délai confirmation TR, exceptions clôturées / quart'],
      ['Aoife Kelly', 'Responsable quai · Sortant', 'AK', 'sage', 'Zéro coupure manquée. Chaque remorque chargée bon du premier coup.', "« Des listes papier. Je ne vois la progression qu'une fois trop tard. »", 'Chargement à temps, taux de short-pick, temps de rotation quai'],
      ['Padraig Ryan', 'Responsable dispensaire', 'PR', 'sunset', 'Micros prêts avant début lot. Zéro erreur de pesée. Traçable.', "« Personne ne voit la file dispensaire tant que rien ne bloque. »", 'Profondeur de file, écart de pesée, taux de réussite lot'],
    ],
    principles: [
      ['01', "Le risque d'abord, le détail ensuite", 'Chaque liste est triée par risque opérationnel. Rouge, orange, vert est une grammaire universelle.'],
      ['02', 'Un objet, plusieurs vues', 'Un ordre process apparaît en préparation, dispensaire, stock et exceptions: le même objet, pas quatre enregistrements.'],
      ['03', 'Langage clair au-dessus, SAP dessous', '"Tâche de rangement" dans l’UI. TO 0023456 dans le détail.'],
      ['04', 'Le temps est une dimension clé', 'Chaque ligne affiche ETA, cut-off ou heure de début, et la distance restante.'],
      ['05', 'Actionnable, pas seulement informatif', 'Chaque carte répond à "que dois-je faire ensuite?" avant "que se passe-t-il?".'],
      ['06', 'Conçu pour 32" et 13"', 'Lisible sur mur de pilotage à 3 mètres; tables denses sur ordinateur responsable.'],
    ],
    scopeIn: ['Control Tower: KPI quart, planning live, flux exceptions, tableau quai', 'Production Staging: ordres process 24h, progression, lien dispensaire', 'Inbound: réceptions PO + STO, affectation quai, progression rangement', 'Outbound: livraisons par cut-off, progression picking/prépa/chargement', 'Inventory & Bins: santé emplacements, stock bord de ligne, péremption lots, HU bloquées', 'Workbench dispensaire: file, progression pesée, statut stations', 'Centre de commande exceptions: priorisé, assignable, transverse', 'Performance: KPI glissants 14 jours par quart / ligne'],
    scopeOut: ["Exécution: l'UI ne poste pas vers SAP; lecture majoritaire avec assigner/confirmer", 'Terminaux opérateur RF: couverts par SAPConsole', 'Gestion yard / réservation porte', 'Planification & MRP: SAP APO reste autoritaire', 'Roll-up multi-usine: Naas uniquement au pilote', 'Modèles prédictifs: risque par règles en v1'],
    roadmap: [['M0', 'Partenaire design', 'Q2', 'Co-design avec chefs de quart Naas. 3 écrans livrables.', 'slate'], ['M1', 'Pilote: Naas', 'Q3', 'Périmètre v1 complet. Intégration lecture seule. Mur point quotidien.', 'forest'], ['M2', '3 usines EMEA', 'Q4', 'Listowel + Charleville. Roll-up multi-usine.', 'sage'], ['M3', 'GA mondiale', 'Y+1', 'Amériques + APAC. Écriture SAP pour confirmer/assigner.', 'sunset']],
  },
  es: {
    problemBody: 'Hoy un responsable de almacén Kerry mantiene la foto operativa en la cabeza y en cinco herramientas: SAP GUI, el panel MII de planta, un informe Power BI, WhatsApp y un A3 en la pared.',
    problemBullets: [['Las decisiones de staging llegan tarde.', 'Los problemas aparecen cuando la línea ya espera, no 90 minutos antes.'], ['La triaje de excepciones es manual.', 'Fallos TR/TO, bloqueos QA y short-picks viven en tres pantallas.'], ['No hay lenguaje compartido.', 'Jefes de sitio hablan SAP; planificación habla producto; operación habla ubicación/línea.'], ['La supervisión móvil no funciona.', 'SAP GUI en tableta no es usable; nadie lo usa.']],
    thesisBody: 'Poner cada señal operativa en una pantalla, ligada a la orden de proceso, la entrega o la ubicación, según piense el usuario, y mostrar el riesgo antes de que sea fallo.',
    thesisBullets: ['Extracción en vivo de LTAK/LTAP, LIKP/LIPS, EKKO/EKPO, LQUA a un modelo de dominio unificado.', 'Gramática única de riesgo (Crítico · En riesgo · En plazo) en todas las pantallas.', 'Etiquetas claras con IDs SAP en detalle: fidelidad híbrida, no SAP puro.', 'Funciona en monitor de control de 32", portátil del responsable y tableta del jefe de turno.'],
    labels: { goal: 'Objetivo:', kpis: 'KPI que gestiona:', metric_one: 'métrica', metric_other: 'métricas', clear: 'Borrar', when: 'Cuándo:', shownOn: 'Se muestra en:', notifies: 'Notifica:', attributes: 'Atributos', relations: 'Relaciones', present: 'presentes', todo: 'Pendiente' },
    personas: [['Warehouse user', 'Responsable de almacén', 'WH', 'slate', 'Cumplir el OTIF del día. Sin apagar fuegos antes del stand-up 08:30.', '“Me entero de un short-pick cuando el camión está en la puerta.”', 'OTIF, DIFOT, puntualidad staging, exactitud de stock'], ['Dara Byrne', 'Jefe de turno · B', 'DB', 'forest', 'Mantener alimentadas las 4 líneas. Resolver excepciones TR en menos de 10 min.', '“Camino 12 km por turno buscando pallets que no están donde SAP dice.”', 'Minutos línea alimentada, tiempo confirmación TR, excepciones cerradas / turno'], ['Aoife Kelly', 'Resp. muelle · Salida', 'AK', 'sage', 'Cero cut-offs perdidos. Cada tráiler cargado bien a la primera.', '“Listas en papel. No veo el avance hasta que es tarde.”', 'Carga a tiempo, tasa short-pick, tiempo de muelle'], ['Padraig Ryan', 'Resp. dispensario', 'PR', 'sunset', 'Micros listos antes del lote. Cero errores de pesada. Trazable.', '“Nadie ve la cola del dispensario hasta que bloquea.”', 'Profundidad cola, variación pesada, tasa pase lote']],
    principles: [['01', 'Riesgo primero, detalle después', 'Cada lista se ordena por riesgo operativo. Rojo, ámbar y verde son gramática común.'], ['02', 'Un objeto, muchas lentes', 'Una orden aparece en staging, dispensario, inventario y excepciones: el mismo objeto.'], ['03', 'Lenguaje claro arriba, SAP debajo', '"Tarea de ubicación" en la UI. TO 0023456 en detalle.'], ['04', 'El tiempo es dimensión principal', 'Cada fila muestra ETA, cut-off o inicio, y cuánto falta.'], ['05', 'Accionable, no solo informativo', 'Cada tarjeta responde "qué hago ahora" antes de "qué ocurre".'], ['06', 'Diseñado para 32" y 13"', 'Legible en sala de control a 3 metros; tablas densas en portátil.']],
    scopeIn: ['Control Tower: KPI de turno, planificación live, feed excepciones, tablero muelle', 'Production Staging: órdenes 24h, avance staging, enlace dispensario', 'Inbound: recepciones PO + STO, asignación muelle, avance putaway', 'Outbound: entregas por cut-off, avance picking/staging/carga', 'Inventory & Bins: salud de ubicaciones, stock línea, caducidad, HU paradas', 'Mesa dispensario: cola, avance pesaje, estado estaciones', 'Centro excepciones: priorizado, asignable, transversal', 'Performance: KPI 14 días por turno / línea'],
    scopeOut: ['Ejecución: la UI no postea a SAP; lectura principal con asignar/confirmar', 'Handhelds RF: cubiertos por SAPConsole', 'Gestión yard / reserva puerta', 'Planificación & MRP: SAP APO sigue siendo autoridad', 'Roll-up multi-planta: solo Naas en piloto', 'Modelos predictivos: riesgo por reglas en v1'],
    roadmap: [['M0', 'Socio de diseño', 'Q2', 'Co-diseño con turnos Naas. 3 pantallas listas.', 'slate'], ['M1', 'Piloto: Naas', 'Q3', 'Alcance v1 completo. Integración solo lectura. Muro diario.', 'forest'], ['M2', '3 plantas EMEA', 'Q4', 'Listowel + Charleville. Roll-up multi-planta.', 'sage'], ['M3', 'GA global', 'Y+1', 'Américas + APAC. Escritura SAP para confirmar/asignar.', 'sunset']],
  },
  de: {
    problemBody: 'Heute hält eine Kerry-Lagerleitung das operative Bild im Kopf plus fünf Tools: SAP GUI, MII-Shopfloor-Dashboard, Power-BI-Bericht, WhatsApp und ein A3-Blatt an der Wand.',
    problemBullets: [['Bereitstellungsentscheidungen kommen spät.', 'Probleme erscheinen, wenn die Linie schon wartet, nicht 90 Minuten vorher.'], ['Ausnahmentriage ist manuell.', 'TR/TO-Fehler, QA-Sperren und Short-Picks liegen in drei Bildschirmen.'], ['Keine gemeinsame Sprache.', 'Standort spricht SAP; Planung Produkt; Bedienung Platz/Linie.'], ['Mobile Aufsicht ist gebrochen.', 'SAP GUI auf dem Tablet ist unbrauchbar; niemand nutzt es.']],
    thesisBody: 'Jedes operative Signal auf einen Bildschirm bringen, am Prozessauftrag, an der Lieferung oder am Lagerplatz ausgerichtet, und Risiko sichtbar machen, bevor es zum Fehler wird.',
    thesisBullets: ['Live-Abruf von LTAK/LTAP, LIKP/LIPS, EKKO/EKPO, LQUA in ein einheitliches Domänenmodell.', 'Einheitliche Risikogrammatik (Kritisch · Gefährdet · Im Plan) auf allen Bildschirmen.', 'Klare Begriffe mit SAP-IDs im Drilldown: hybride Genauigkeit, nicht reines SAP.', 'Funktioniert auf 32"-Leitstand, Manager-Laptop und Tablet der Schichtleitung.'],
    labels: { goal: 'Ziel:', kpis: 'Eigene KPIs:', metric_one: 'Kennzahl', metric_other: 'Kennzahlen', clear: 'Leeren', when: 'Wenn:', shownOn: 'Angezeigt in:', notifies: 'Benachrichtigt:', attributes: 'Attribute', relations: 'Beziehungen', present: 'vorhanden', todo: 'TODO' },
    personas: [['Warehouse user', 'Lagerleitung', 'WH', 'slate', 'Heutiges OTIF erreichen. Kein Feuerlöschen vor dem 08:30-Stand-up.', '„Ich erfahre vom Short-Pick, wenn der LKW am Tor steht.“', 'OTIF, DIFOT, Bereitstellung pünktlich, Bestandsgenauigkeit'], ['Dara Byrne', 'Schichtleitung · B', 'DB', 'forest', 'Die 4 Linien versorgen. TR-Ausnahmen in unter 10 Min. lösen.', '„Ich laufe 12 km pro Schicht und suche Paletten, die nicht dort sind, wo SAP sagt.“', 'Linienversorgungsminuten, TR-Bestätigungszeit, Ausnahmen / Schicht'], ['Aoife Kelly', 'Dockleitung · Ausgang', 'AK', 'sage', 'Keine Cut-offs verpassen. Jeden Trailer beim ersten Mal richtig laden.', '„Papierpicklisten. Ich sehe den Fortschritt erst, wenn es zu spät ist.“', 'Pünktliche Ladung, Short-Pick-Rate, Dock-Durchlaufzeit'], ['Padraig Ryan', 'Dosierleitung', 'PR', 'sunset', 'Mikros vor Batchstart bereit. Null Wiegefehler. Rückverfolgbar.', '„Niemand sieht die Dosierschlange, bis etwas blockiert.“', 'Warteschlange, Wiegeabweichung, Batch-Passrate']],
    principles: [['01', 'Risiko zuerst, Detail danach', 'Jede Liste sortiert standardmäßig nach operativem Risiko. Rot, Gelb, Grün ist die gemeinsame Sprache.'], ['02', 'Ein Objekt, viele Sichten', 'Ein Prozessauftrag erscheint in Bereitstellung, Dosierung, Bestand und Ausnahmen: dasselbe Objekt.'], ['03', 'Klare Sprache oben, SAP darunter', '"Einlagerungsaufgabe" in der UI. TO 0023456 im Drilldown.'], ['04', 'Zeit ist eine Kerndimension', 'Jede Zeile zeigt ETA, Cut-off oder Startzeit und den Abstand dazu.'], ['05', 'Handlungsorientiert, nicht nur informativ', 'Jede Karte beantwortet "was tue ich als Nächstes?" vor "was passiert?".'], ['06', 'Für 32" und 13" gebaut', 'Lesbar an der Leitstandswand aus 3 Metern; dichte Tabellen am Laptop.']],
    scopeIn: ['Control Tower: Schicht-KPIs, Live-Plan, Ausnahmefeed, Dockboard', 'Production Staging: Prozessaufträge 24h, Fortschritt, Dosierlink', 'Inbound: PO + STO Wareneingänge, Dockzuweisung, Einlagerfortschritt', 'Outbound: Lieferungen nach Cut-off, Pick/Stage/Load-Fortschritt', 'Inventory & Bins: Platzgesundheit, Linienbestand, Batch-Ablauf, stehende HUs', 'Dosier-Workbench: Warteschlange, Wiegefortschritt, Stationsstatus', 'Ausnahmezentrum: priorisiert, zuweisbar, domänenübergreifend', 'Performance: rollierende KPIs 14 Tage nach Schicht / Linie'],
    scopeOut: ['Ausführung: UI postet nicht nach SAP; primär lesend mit Zuweisen/Bestätigen', 'RF-Handhelds: durch SAPConsole abgedeckt', 'Yard Management / Torbuchung', 'Planung & MRP: SAP APO bleibt führend', 'Multi-Plant-Rollup: im Pilot nur Naas', 'Prädiktive Modelle: in v1 nur regelbasiertes Risiko'],
    roadmap: [['M0', 'Designpartner', 'Q2', 'Co-Design mit Schichtleitungen Naas. 3 Screens lieferbar.', 'slate'], ['M1', 'Pilot: Naas', 'Q3', 'Voller v1-Umfang. Nur-Lese-Integration. Tägliche Wandübersicht.', 'forest'], ['M2', '3 Werke EMEA', 'Q4', 'Listowel + Charleville. Multi-Plant-Rollup.', 'sage'], ['M3', 'Global GA', 'Y+1', 'Americas + APAC. SAP-Schreibzugriff für Bestätigen/Zuweisen.', 'sunset']],
  },
};

const localeVariants = {
  fr: {
    kpi: {
      eyebrow: 'Catalogue KPI · v0.4 · {{count}} indicateurs',
      title: 'Chaque chiffre, sa formule et son responsable.',
      lede: "Voici les KPI que Warehouse Manager 360° calcule, affiche et alerte. Chacun possède une formule unique, une source de vérité unique et un rôle responsable unique.",
      search: 'Filtrer par nom, formule, source, responsable…',
      derived: 'Dérivé des objectifs',
      alertTitle: "Règles d'alerte",
      columns: ['Indicateur', 'Formule', 'Objectif', 'Fréq.', 'Source de vérité', 'Responsable'],
      domains: ['Sortant', 'Préparation production', 'Entrant', 'Stock', 'Dispensaire', 'Exceptions'],
      freqs: { shift: 'Quart', daily: 'Jour', live: 'Direct', weekly: 'Semaine', batch: 'Lot' },
      names: ['OTIF: à temps et complet', 'Temps de rotation quai', 'Taux short-pick', 'Chargement à temps', 'Alertes de dépassement cut-off', 'Ponctualité préparation', 'Minutes ligne alimentée', 'Délai moyen de préparation', 'Taux split-pick', 'Écart réception PO', 'Temps de cycle rangement', 'Délai de levée QA', 'Réception à temps', 'Exactitude stock (inventaire tournant)', 'Expiration lot ≤ 30j', 'Utilisation emplacements (bulk)', 'HU bloquées (> 24h sans mouvement)', 'Écart de pesée', 'Profondeur de file', 'Lot prêt avant démarrage', 'Temps moyen de prise en compte', 'Temps moyen de résolution', 'Taux de réouverture exception'],
      alerts: [['Dépassement cut-off', 'Livraison · pickPct < 80% ∧ cut-off < 90 min', 'Sortant · Control Tower · Exceptions', 'Resp. quai + Resp. site'], ['Préparation à risque', 'Ordre process · staged < 90% ∧ start < 45 min', 'Préparation · Control Tower · Exceptions', "Chef d'équipe"], ['Entrant en retard', 'Réception · ETA + 30 min ∧ statut = Attendue', 'Entrant · Control Tower', 'Resp. réception'], ['Escalade blocage QA', 'Blocage QA > 4h ∧ requis pour lot du jour', 'Entrant · Exceptions', "Resp. QA + Chef d'équipe"], ['HU bloquée', 'HU · dernier mouvement > 24h ∧ statut ≠ expédié', 'Stock · Exceptions', "Chef d'équipe"], ['Expiration lot', 'Lot · BBD − maintenant ≤ 14j ∧ onHand > 0', 'Stock', 'Planificateur + Resp. site'], ['Blocage dispensaire', 'Lot · micros < 100% ∧ début ordre < 30 min', 'Dispensaire · Préparation · Exceptions', 'Resp. dispensaire']],
    },
    data: {
      eyebrow: 'Modèle de données · v0.4 · 12 entités clés',
      title: 'Un modèle de domaine unifié sur cinq modules SAP.',
      lede: "L'UI n'expose jamais les tables SAP directement. Une couche domaine légère mappe LTAK, LIKP, EKPO, LQUA, LAGP, MCHA et les événements de pesée MII vers les douze entités ci-dessous.",
      meta: [['Accès', 'Lecture majoritaire · SAP OData + vues CDS'], ['Écriture retour', 'Assigner · confirmer seulement (v1)'], ['Cache', '30 s · emplacements & dispensaire live'], ['Cible latence', 'p95 ≤ 1,2 s premier rendu']],
      erTitle: 'Relation entre entités',
      erEyebrow: 'Carte du domaine cœur',
      erSubtitle: 'Survolez une entité pour voir sa source SAP. Les flèches indiquent la cardinalité.',
      fieldTitle: 'Mapping champs SAP',
      fieldEyebrow: 'Référence · fidélité hybride',
      fieldColumns: ['Libellé UI', 'Champ domaine', 'Table SAP · champ', 'Notes'],
      sapTitle: 'Disponibilité tables SAP',
      sapColumns: ['Table SAP', 'Description', 'Table schéma / TODO'],
      integrationTitle: "Surface d'intégration",
      integrationEyebrow: 'Qui parle à quoi',
    },
  },
  es: {
    kpi: {
      eyebrow: 'Catálogo KPI · v0.4 · {{count}} métricas',
      title: 'Cada número, su fórmula y quién lo gestiona.',
      lede: 'Estos son los KPI que Warehouse Manager 360° calcula, muestra y alerta. Cada uno tiene una fórmula única, una fuente de verdad única y un rol responsable.',
      search: 'Filtrar por nombre, fórmula, fuente, responsable…',
      derived: 'Derivado de objetivos',
      alertTitle: 'Reglas de alerta',
      columns: ['Métrica', 'Fórmula', 'Objetivo', 'Frec.', 'Fuente de verdad', 'Responsable'],
      domains: ['Salida', 'Staging producción', 'Entrada', 'Inventario', 'Dispensario', 'Excepciones'],
      freqs: { shift: 'Turno', daily: 'Diario', live: 'Live', weekly: 'Semanal', batch: 'Lote' },
      names: ['OTIF: a tiempo y completo', 'Tiempo de muelle', 'Tasa short-pick', 'Carga a tiempo', 'Alertas de incumplimiento cut-off', 'Puntualidad staging', 'Minutos línea alimentada', 'Lead time medio staging', 'Tasa split-pick', 'Variación recepción PO', 'Tiempo ciclo putaway', 'Tiempo liberación QA', 'GR a tiempo', 'Exactitud stock (conteo cíclico)', 'Caducidad lote ≤ 30d', 'Utilización bins (bulk)', 'HU paradas (> 24h sin movimiento)', 'Variación pesada', 'Profundidad cola', 'Lote listo antes de inicio', 'Tiempo medio a reconocer', 'Tiempo medio a resolver', 'Tasa reapertura excepciones'],
      alerts: [['Incumplimiento cut-off', 'Entrega · pickPct < 80% ∧ cut-off < 90 min', 'Salida · Control Tower · Excepciones', 'Resp. muelle + Resp. sitio'], ['Staging en riesgo', 'Orden proceso · staged < 90% ∧ start < 45 min', 'Staging · Control Tower · Excepciones', 'Jefe de turno'], ['Entrada vencida', 'Recepción · ETA + 30 min ∧ estado = Esperada', 'Entrada · Control Tower', 'Resp. recepción'], ['Escalada QA hold', 'QA hold > 4h ∧ necesario para lote de hoy', 'Entrada · Excepciones', 'Resp. QA + Jefe de turno'], ['HU parada', 'HU · último movimiento > 24h ∧ estado ≠ expedido', 'Inventario · Excepciones', 'Jefe de turno'], ['Caducidad lote', 'Lote · BBD − ahora ≤ 14d ∧ onHand > 0', 'Inventario', 'Planificador + Resp. sitio'], ['Bloqueo dispensario', 'Lote · micros < 100% ∧ inicio orden < 30 min', 'Dispensario · Staging · Excepciones', 'Resp. dispensario']],
    },
    data: {
      eyebrow: 'Modelo de datos · v0.4 · 12 entidades core',
      title: 'Un modelo de dominio unificado sobre cinco módulos SAP.',
      lede: 'La UI nunca expone tablas SAP directamente. Una capa de dominio ligera mapea LTAK, LIKP, EKPO, LQUA, LAGP, MCHA y eventos de báscula MII a las doce entidades siguientes.',
      meta: [['Acceso', 'Lectura principal · SAP OData + vistas CDS'], ['Write-back', 'Asignar · reconocer solo (v1)'], ['Cache', '30 s · bins & dispensario live'], ['Objetivo latencia', 'p95 ≤ 1,2 s primer render']],
      erTitle: 'Relación de entidades',
      erEyebrow: 'Mapa core de dominio',
      erSubtitle: 'Pasa sobre una entidad para ver su fuente SAP. Las flechas indican cardinalidad.',
      fieldTitle: 'Mapeo campos SAP',
      fieldEyebrow: 'Referencia · fidelidad híbrida',
      fieldColumns: ['Etiqueta UI', 'Campo dominio', 'Tabla SAP · campo', 'Notas'],
      sapTitle: 'Disponibilidad tablas SAP',
      sapColumns: ['Tabla SAP', 'Descripción', 'Tabla esquema / TODO'],
      integrationTitle: 'Superficie de integración',
      integrationEyebrow: 'Qué habla con qué',
    },
  },
  de: {
    kpi: {
      eyebrow: 'KPI-Katalog · v0.4 · {{count}} Kennzahlen',
      title: 'Jede Zahl, ihre Formel und ihre Verantwortung.',
      lede: 'Dies sind die KPIs, die Warehouse Manager 360° berechnet, anzeigt und alarmiert. Jede hat eine Formel, eine Quelle der Wahrheit und eine verantwortliche Rolle.',
      search: 'Nach Name, Formel, Quelle, Besitzer filtern…',
      derived: 'Aus Zielen abgeleitet',
      alertTitle: 'Alarmregeln',
      columns: ['Kennzahl', 'Formel', 'Ziel', 'Freq.', 'Quelle der Wahrheit', 'Verantwortlich'],
      domains: ['Ausgang', 'Produktionsbereitstellung', 'Eingang', 'Bestand', 'Dosierung', 'Ausnahmen'],
      freqs: { shift: 'Schicht', daily: 'Täglich', live: 'Live', weekly: 'Wöchentlich', batch: 'Batch' },
      names: ['OTIF: pünktlich und vollständig', 'Dock-Durchlaufzeit', 'Short-Pick-Rate', 'Laden pünktlich', 'Cut-off-Alarm ausgelöst', 'Bereitstellung pünktlich', 'Linienversorgungsminuten', 'Durchschnittliche Bereitstellzeit', 'Split-Pick-Rate', 'PO-Eingangsabweichung', 'Einlagerungszykluszeit', 'QA-Freigabezeit', 'WE pünktlich', 'Bestandsgenauigkeit (Zählung)', 'Batch-Ablauf ≤ 30T', 'Lagerplatzauslastung (Bulk)', 'Stehende HUs (> 24h keine Bewegung)', 'Wiegeabweichung', 'Warteschlangentiefe', 'Batch vor Start bereit', 'Mittlere Bestätigungszeit', 'Mittlere Lösungszeit', 'Wiedereröffnungsrate Ausnahmen'],
      alerts: [['Cut-off-Verstoß', 'Lieferung · pickPct < 80% ∧ cut-off < 90 min', 'Ausgang · Control Tower · Ausnahmen', 'Dockleitung + Standortleitung'], ['Bereitstellung gefährdet', 'Prozessauftrag · staged < 90% ∧ start < 45 min', 'Bereitstellung · Control Tower · Ausnahmen', 'Schichtleitung'], ['Eingang überfällig', 'Wareneingang · ETA + 30 min ∧ Status = Erwartet', 'Eingang · Control Tower', 'Wareneingangsleitung'], ['QA-Sperre eskaliert', 'QA-Sperre > 4h ∧ für heutigen Batch benötigt', 'Eingang · Ausnahmen', 'QA-Leitung + Schichtleitung'], ['Stehende HU', 'HU · letzte Bewegung > 24h ∧ Status ≠ versandt', 'Bestand · Ausnahmen', 'Schichtleitung'], ['Batch-Ablauf', 'Batch · BBD − jetzt ≤ 14T ∧ onHand > 0', 'Bestand', 'Planung + Standortleitung'], ['Dosierblockade', 'Batch · micros < 100% ∧ Auftragsstart < 30 min', 'Dosierung · Bereitstellung · Ausnahmen', 'Dosierleitung']],
    },
    data: {
      eyebrow: 'Datenmodell · v0.4 · 12 Kernentitäten',
      title: 'Ein einheitliches Domänenmodell über fünf SAP-Module.',
      lede: 'Die UI zeigt SAP-Tabellen nie direkt. Eine leichte Domänenschicht mappt LTAK, LIKP, EKPO, LQUA, LAGP, MCHA und MII-Wiegeereignisse auf die zwölf Entitäten unten.',
      meta: [['Zugriff', 'Primär lesend · SAP OData + CDS-Views'], ['Write-back', 'Nur zuweisen · bestätigen (v1)'], ['Cache', '30 s · Plätze & Dosierung live'], ['Latenzziel', 'p95 ≤ 1,2 s First Paint']],
      erTitle: 'Entitätsbeziehung',
      erEyebrow: 'Kern-Domänenkarte',
      erSubtitle: 'Entität hovern, um SAP-Quelle zu sehen. Pfeile zeigen Kardinalität.',
      fieldTitle: 'SAP-Feldmapping',
      fieldEyebrow: 'Referenz · hybride Genauigkeit',
      fieldColumns: ['UI-Label', 'Domänenfeld', 'SAP-Tabelle · Feld', 'Notizen'],
      sapTitle: 'SAP-Tabellenverfügbarkeit',
      sapColumns: ['SAP-Tabelle', 'Beschreibung', 'Schema-Tabelle / TODO'],
      integrationTitle: 'Integrationsfläche',
      integrationEyebrow: 'Was mit was spricht',
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeCopy = (language: any): any => {
  const base = docsCopy.en;
  const localized = docsCopy[language] ?? base;
  const variant = localeVariants[language] ?? {};
  return {
    ...base,
    ...localized,
    kpi: { ...base.kpi, ...(variant.kpi ?? {}) },
    data: { ...base.data, ...(variant.data ?? {}) },
  };
};

const kpiLayout = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19],
  [20, 21, 22],
];

const kpiMeta = [
  ['≥ 98.5%', 'shift', 'LIKP · VBFA · actual GI', ['site', 'dock']],
  ['≤ 42 min', 'daily', 'LIKP · gate log', ['dock']],
  ['≤ 0.5%', 'shift', 'LTAK · LTAP', ['shift']],
  ['≥ 99%', 'shift', 'LIKP · VTFL', ['dock']],
  ['≤ 2/day', 'live', 'Derived', ['site']],
  ['≥ 97%', 'shift', 'AFKO · LTAK', ['shift']],
  ['≥ 99.2%', 'shift', 'PP confirmations', ['shift']],
  ['≤ 45 min', 'daily', 'LTAK · LTAP', ['shift']],
  ['≤ 12%', 'daily', 'LTAP · LQUA', ['site']],
  ['≤ 0.8%', 'daily', 'EKPO · MSEG', ['goodsIn']],
  ['≤ 38 min', 'daily', 'LTAK · MKPF', ['shift']],
  ['≤ 4 h', 'daily', 'QALS · QINF', ['qa']],
  ['≥ 95%', 'daily', 'EKPO · MKPF', ['goodsIn']],
  ['≥ 99.3%', 'weekly', 'LINV · LIKP', ['site']],
  ['trend ↓', 'daily', 'LQUA · MCHA', ['site', 'planner']],
  ['65–80%', 'daily', 'LQUA · LAGP', ['site']],
  ['≤ 6', 'live', 'LQUA · LTAK', ['shift']],
  ['≤ 0.15%', 'batch', 'MII scale feed', ['dispensary']],
  ['≤ 6', 'live', 'PP · MII', ['dispensary']],
  ['≥ 99%', 'shift', 'AFKO · MII', ['dispensary']],
  ['≤ 6 min', 'shift', 'Derived', ['shift']],
  ['≤ 35 min', 'shift', 'Derived', ['shift']],
  ['≤ 3%', 'weekly', 'Derived', ['site']],
];

const dataEntityMeta = [
  ['process_order', 'AFKO · AFPO', 'forest', ['id (process_order_no)', 'material', 'line_id', 'planned_start', 'planned_end', 'qty · uom', 'status', 'staging_method', 'risk', 'shift_id'], ['→ transfer_order (1..n)', '→ batch (1..n)', '→ dispensary_batch (0..n)', '→ exception (0..n)']],
  ['transfer_order', 'LTAK · LTAP', 'slate', ['id (to_number)', 'type (pick/putaway/replen/internal)', 'material', 'qty · uom', 'src_bin', 'dst_bin', 'status', 'confirmed_at', 'assigned_to', 'sscc'], ['← process_order (0..1)', '← delivery (0..1)', '→ handling_unit (0..1)', '→ exception (0..n)']],
  ['delivery', 'LIKP · LIPS', 'sunset', ['id (delivery_no)', 'sales_order_no', 'customer', 'carrier', 'dock_id', 'cut_off_ts', 'status', 'pick_pct', 'stage_pct', 'load_pct', 'weight', 'pallet_count', 'risk'], ['→ transfer_order (1..n)', '→ handling_unit (1..n)', '→ exception (0..n)']],
  ['receipt', 'EKKO · EKPO · MKPF', 'sage', ['id (po_or_sto_no)', 'type (PO/STO)', 'vendor_or_plant', 'material', 'expected_qty', 'received_qty · uom', 'eta', 'dock_id', 'status', 'qa_status', 'risk'], ['→ batch (0..n)', '→ handling_unit (0..n)', '→ transfer_order (0..n)']],
  ['handling_unit', 'VEKP · VEPO · SSCC', 'valentia', ['id (sscc)', 'packaging_type', 'net_weight', 'gross_weight', 'location_bin', 'last_move_ts', 'material', 'batch_no', 'status'], ['← receipt (0..1)', '← delivery (0..1)', '→ quant (1..n)']],
  ['quant', 'LQUA', 'jade', ['id (synthetic)', 'bin_id', 'material', 'batch_no', 'qty · uom', 'placed_at', 'expiry_bbd', 'blocked_qty', 'qa_status'], ['← storage_bin (1..1)', '← batch (1..1)', '← handling_unit (0..1)']],
  ['storage_bin', 'LAGP', 'slate', ['id (bin_id)', 'storage_type (001/002/003/005/050/010)', 'aisle · rack · level', 'status (free/occupied/blocked)', 'max_weight', 'max_volume'], ['→ quant (0..n)']],
  ['batch', 'MCHA · MCH1', 'sunrise', ['id (batch_no)', 'material', 'mfg_date', 'bbd_expiry', 'qa_status', 'origin_receipt · origin_process_order', 'remaining_qty · uom'], ['→ quant (0..n)', '→ process_order (0..n consume)', '→ dispensary_weight (0..n)']],
  ['dispensary', 'MII ext', 'sunset', ['id', 'process_order', 'station_id', 'scale_id', 'required_components (json)', 'weighed_components (json)', 'queue_position', 'status', 'variance_pct'], ['← process_order (1..1)', '→ dispensary_weight (1..n)']],
  ['exception', 'Derived', 'sunset', ['id', 'type', 'severity (red/amber)', 'raised_ts', 'age_minutes', 'related_object_id · type', 'assigned_to', 'status (open/ack/resolved)', 'resolution_ts', 'notes'], ['→ any operational object (polymorphic)']],
  ['material', 'MARA · MARC · MARD', 'forest', ['id (material_no)', 'description', 'uom', 'abc_class', 'storage_conditions', 'shelf_life_days', 'qa_test_required', 'allergens[]'], ['← batch (0..n)', '← quant (0..n)']],
  ['shift', 'Calendar', 'slate', ['id (A/B/C)', 'label', 'start_ts', 'end_ts', 'lead_user'], ['→ process_order (0..n)', '→ exception (0..n)']],
];

const entityLabels = {
  en: ['Process Order', 'Transfer Order', 'Outbound Delivery', 'Receipt (PO/STO)', 'Handling Unit (HU)', 'Quant (bin stock)', 'Storage Bin', 'Batch', 'Dispensary Batch', 'Exception', 'Material Master', 'Shift'],
  fr: ['Ordre process', 'Ordre de transfert', 'Livraison sortante', 'Réception (PO/STO)', 'Unité de manutention (HU)', 'Quant (stock emplacement)', 'Emplacement', 'Lot', 'Lot dispensaire', 'Exception', 'Fiche article', 'Quart'],
  es: ['Orden de proceso', 'Orden de traslado', 'Entrega saliente', 'Recepción (PO/STO)', 'Unidad de manipulación (HU)', 'Quant (stock ubicación)', 'Ubicación', 'Lote', 'Lote dispensario', 'Excepción', 'Maestro material', 'Turno'],
  de: ['Prozessauftrag', 'Transportauftrag', 'Ausgangslieferung', 'Wareneingang (PO/STO)', 'Handling Unit (HU)', 'Quant (Platzbestand)', 'Lagerplatz', 'Batch', 'Dosierbatch', 'Ausnahme', 'Materialstamm', 'Schicht'],
};

const fieldRows = {
  en: [
    ['Process order', 'process_order.id', 'AFKO · AUFNR', 'Leading digit indicates plant; prefix shown in drill-down only'],
    ['Transfer Order', 'transfer_order.id', 'LTAK · TANUM', '10-digit. Type from LTAK-BWLVS'],
    ['Delivery', 'delivery.id', 'LIKP · VBELN', 'Outbound only. Inbound deliveries excluded in v1'],
    ['Pick %', 'delivery.pick_pct', 'LIPS · PIKMG ÷ LFIMG', 'Weighted by LIPS-LFIMG to avoid many-small-lines skew'],
    ['Staged %', 'delivery.stage_pct', 'Derived from LTAK', 'LTAK confirmed to storage type 916 (staging)'],
    ['Cut-off', 'delivery.cut_off_ts', 'LIKP · LDDAT + LDTIM', 'Site local TZ, fallback to route master'],
    ['Receipt (PO)', 'receipt.id', 'EKKO · EBELN', 'Header only; body lines collapsed into receipt'],
    ['Received qty', 'receipt.received_qty', 'Σ MSEG · MENGE where BWART in 101/105', 'Excludes reversals 102/106'],
    ['HU', 'handling_unit.id', 'VEKP · EXIDV (SSCC)', '18-digit, displayed 4-chunked'],
    ['Bin', 'storage_bin.id', 'LAGP · LGPLA', 'Display as {type}-{aisle}{rack}-L{level}'],
    ['Batch expiry', 'batch.bbd_expiry', 'MCH1 · VFDAT', 'Site-local, days-to-expiry computed client-side'],
    ['QA hold', 'receipt.qa_status = "QA Hold"', 'QALS · PRUEFLOS + QSSR', 'Released = QSSR-RESULT = "A"'],
  ],
  fr: [
    ['Ordre process', 'process_order.id', 'AFKO · AUFNR', 'Le premier chiffre indique le site; préfixe seulement au détail'],
    ['Ordre de transfert', 'transfer_order.id', 'LTAK · TANUM', '10 chiffres. Type depuis LTAK-BWLVS'],
    ['Livraison', 'delivery.id', 'LIKP · VBELN', 'Sortant seulement. Entrant exclu en v1'],
    ['Pick %', 'delivery.pick_pct', 'LIPS · PIKMG ÷ LFIMG', 'Pondéré par LIPS-LFIMG pour éviter le biais petites lignes'],
    ['Staged %', 'delivery.stage_pct', 'Dérivé de LTAK', 'LTAK confirmé vers type stockage 916 (staging)'],
    ['Cut-off', 'delivery.cut_off_ts', 'LIKP · LDDAT + LDTIM', 'Fuseau local site, fallback route master'],
    ['Réception (PO)', 'receipt.id', 'EKKO · EBELN', 'En-tête seulement; lignes agrégées dans la réception'],
    ['Qté reçue', 'receipt.received_qty', 'Σ MSEG · MENGE where BWART in 101/105', 'Hors annulations 102/106'],
    ['HU', 'handling_unit.id', 'VEKP · EXIDV (SSCC)', '18 chiffres, affiché en 4 blocs'],
    ['Emplacement', 'storage_bin.id', 'LAGP · LGPLA', 'Affiché {type}-{aisle}{rack}-L{level}'],
    ['Péremption lot', 'batch.bbd_expiry', 'MCH1 · VFDAT', 'Calcul jours restants côté client'],
    ['Blocage QA', 'receipt.qa_status = "QA Hold"', 'QALS · PRUEFLOS + QSSR', 'Libéré = QSSR-RESULT = "A"'],
  ],
};
fieldRows.es = [
  ['Orden proceso', 'process_order.id', 'AFKO · AUFNR', 'El primer dígito indica planta; prefijo solo en detalle'],
  ['Orden traslado', 'transfer_order.id', 'LTAK · TANUM', '10 dígitos. Tipo desde LTAK-BWLVS'],
  ['Entrega', 'delivery.id', 'LIKP · VBELN', 'Solo salida. Entradas excluidas en v1'],
  ['Pick %', 'delivery.pick_pct', 'LIPS · PIKMG ÷ LFIMG', 'Ponderado por LIPS-LFIMG para evitar sesgo de líneas pequeñas'],
  ['Staged %', 'delivery.stage_pct', 'Derivado de LTAK', 'LTAK confirmado a tipo almacén 916 (staging)'],
  ['Cut-off', 'delivery.cut_off_ts', 'LIKP · LDDAT + LDTIM', 'Zona local sitio, fallback maestro ruta'],
  ['Recepción (PO)', 'receipt.id', 'EKKO · EBELN', 'Solo cabecera; líneas colapsadas en recepción'],
  ['Cantidad recibida', 'receipt.received_qty', 'Σ MSEG · MENGE where BWART in 101/105', 'Excluye reversos 102/106'],
  ['HU', 'handling_unit.id', 'VEKP · EXIDV (SSCC)', '18 dígitos, mostrado en 4 bloques'],
  ['Ubicación', 'storage_bin.id', 'LAGP · LGPLA', 'Mostrar como {type}-{aisle}{rack}-L{level}'],
  ['Caducidad lote', 'batch.bbd_expiry', 'MCH1 · VFDAT', 'Días a caducidad calculados en cliente'],
  ['QA hold', 'receipt.qa_status = "QA Hold"', 'QALS · PRUEFLOS + QSSR', 'Liberado = QSSR-RESULT = "A"'],
];
fieldRows.de = [
  ['Prozessauftrag', 'process_order.id', 'AFKO · AUFNR', 'Erste Ziffer zeigt Werk; Präfix nur im Drilldown'],
  ['Transportauftrag', 'transfer_order.id', 'LTAK · TANUM', '10-stellig. Typ aus LTAK-BWLVS'],
  ['Lieferung', 'delivery.id', 'LIKP · VBELN', 'Nur Ausgang. Eingänge in v1 ausgeschlossen'],
  ['Pick %', 'delivery.pick_pct', 'LIPS · PIKMG ÷ LFIMG', 'Gewichtet nach LIPS-LFIMG gegen Kleinline-Bias'],
  ['Staged %', 'delivery.stage_pct', 'Abgeleitet aus LTAK', 'LTAK bestätigt zu Lagertyp 916 (Staging)'],
  ['Cut-off', 'delivery.cut_off_ts', 'LIKP · LDDAT + LDTIM', 'Lokale Standortzeit, Fallback Route Master'],
  ['Wareneingang (PO)', 'receipt.id', 'EKKO · EBELN', 'Nur Kopf; Positionen in Eingang zusammengeführt'],
  ['Empfangene Menge', 'receipt.received_qty', 'Σ MSEG · MENGE where BWART in 101/105', 'Ohne Stornos 102/106'],
  ['HU', 'handling_unit.id', 'VEKP · EXIDV (SSCC)', '18-stellig, in 4 Blöcken angezeigt'],
  ['Lagerplatz', 'storage_bin.id', 'LAGP · LGPLA', 'Anzeige als {type}-{aisle}{rack}-L{level}'],
  ['Batch-Ablauf', 'batch.bbd_expiry', 'MCH1 · VFDAT', 'Tage bis Ablauf clientseitig berechnet'],
  ['QA-Sperre', 'receipt.qa_status = "QA Hold"', 'QALS · PRUEFLOS + QSSR', 'Freigegeben = QSSR-RESULT = "A"'],
];

const sapRows = [
  ['PP', 'AFKO', 'Production order header', 'productionorderobject_afko', true],
  ['PP', 'AFPO', 'Production order item', 'productionorderobject_afpo', true],
  ['PP', 'RESB', 'Reservation / dependent requirements', 'reservationrequirement_resb', true],
  ['WM', 'LTAK', 'Transfer order header', 'transferorderobjects_ltak', true],
  ['WM', 'LTAP', 'Transfer order item', 'transferorderobjects_ltap', true],
  ['WM', 'LTBK', 'Transfer requirement header', 'transferrequirementobjects_ltbk', true],
  ['WM', 'LAGP', 'Storage bin master', 'storagebin_lagp', true],
  ['WM', 'LQUA', 'Quants (bin stock)', 'quant_lqua', true],
  ['WM', 'LINV', 'WM inventory document header', 'Not in either schema. central_services has IKPF + ISEG which may cover this; confirm with SAP team before requesting LINV extraction.', false],
  ['LE/SD', 'LIKP', 'Delivery header', 'deliveryobjects_likp', true],
  ['LE/SD', 'LIPS', 'Delivery item', 'deliveryobjects_lips', true],
  ['LE/SD', 'VBFA', 'Sales / delivery document flow', 'salesorderobject_vbfa', true],
  ['LE/SD', 'VTFL', 'Delivery / billing document flow', 'Not in either schema. Used for loading on-time KPI; LIKP-WADAT_IST may substitute.', false],
  ['MM', 'EKKO', 'Purchase order header', 'procurementorderobject_ekko', true, 'central'],
  ['MM', 'EKPO', 'Purchase order item', 'procurementorderobject_ekpo', true, 'central'],
  ['MM', 'MKPF', 'Material document header', 'materialdocument_mkpf', true],
  ['MM', 'MSEG', 'Material document item (GR / GI movements)', 'inventorymovement_mseg', true],
  ['Material', 'MARA', 'Material master: general data', 'materialmaster_mara', true],
  ['Material', 'MARC', 'Material master: plant data', 'materialforplant_marc', true],
  ['Material', 'MARD', 'Storage location stock', 'storagelocationmaterial_mard', true],
  ['Batch', 'MCHA', 'Batch master data', 'batches_mcha', true, 'central'],
  ['Batch', 'MCH1', 'Cross-plant batch', 'crossplantbatch_mch1', true],
  ['HU', 'VEKP', 'Handling unit header (SSCC)', 'handlingunit_vekp', true, 'central'],
  ['HU', 'VEPO', 'Handling unit item (contents)', 'handlingunit_vepo', true, 'central'],
  ['QM', 'QALS', 'Inspection lot', 'inspection_qals', true],
  ['QM', 'QSSR', 'Quality certificate', 'Required for QA release status. Check whether QALS usage-decision fields are sufficient before requesting QSSR.', false],
  ['QM', 'QINF', 'Quality info record', 'Used for QA hold turnaround KPI. Confirm with QA lead if QALS status fields cover this use case.', false],
];

const integrations = {
  en: [['SAP ECC', 'System of record', 'MARA · AFKO · LTAK · LIKP · EKKO · LQUA · MCHA · QALS', '30 s OData poll · bulk CDS nightly'], ['SAP EWM', 'Warehouse execution', 'HU moves · task status · bin updates', 'Event-driven via IDoc'], ['SAP MII', 'Shop-floor', 'Dispensary scale feed · line run-state', 'Live WebSocket'], ['Gate log', 'Yard · carrier', 'Truck arrive/depart timestamps', '2 min poll'], ['SSO', 'Identity', 'User · role · plant membership', 'OIDC'], ['WM360', 'Derived store', 'Exceptions · assignments · acknowledgements', 'Owned by this app']],
  fr: [['SAP ECC', 'Système de référence', 'MARA · AFKO · LTAK · LIKP · EKKO · LQUA · MCHA · QALS', 'Sondage OData 30 s · CDS bulk nuit'], ['SAP EWM', 'Exécution entrepôt', 'Mouvements HU · statut tâches · mises à jour emplacements', 'Piloté par événement via IDoc'], ['SAP MII', 'Atelier', 'Flux balances dispensaire · état ligne', 'WebSocket live'], ['Journal porte', 'Yard · transporteur', 'Horodatages arrivée/départ camion', 'Sondage 2 min'], ['SSO', 'Identité', 'Utilisateur · rôle · appartenance site', 'OIDC'], ['WM360', 'Magasin dérivé', 'Exceptions · affectations · confirmations', "Possédé par l'app"]],
  es: [['SAP ECC', 'Sistema de registro', 'MARA · AFKO · LTAK · LIKP · EKKO · LQUA · MCHA · QALS', 'Poll OData 30 s · CDS bulk nocturno'], ['SAP EWM', 'Ejecución almacén', 'Movimientos HU · estado tareas · actualizaciones bins', 'Eventos vía IDoc'], ['SAP MII', 'Planta', 'Feed básculas dispensario · estado línea', 'WebSocket live'], ['Gate log', 'Yard · transportista', 'Timestamps llegada/salida camión', 'Poll 2 min'], ['SSO', 'Identidad', 'Usuario · rol · pertenencia planta', 'OIDC'], ['WM360', 'Store derivado', 'Excepciones · asignaciones · reconocimientos', 'Propio de esta app']],
  de: [['SAP ECC', 'Führendes System', 'MARA · AFKO · LTAK · LIKP · EKKO · LQUA · MCHA · QALS', '30 s OData-Poll · CDS nachts bulk'], ['SAP EWM', 'Lagerausführung', 'HU-Bewegungen · Aufgabenstatus · Platzupdates', 'Ereignisgetrieben via IDoc'], ['SAP MII', 'Shopfloor', 'Dosierwaagenfeed · Linienzustand', 'Live WebSocket'], ['Gate log', 'Yard · Spediteur', 'LKW Ankunft/Abfahrt Zeitstempel', '2 min Poll'], ['SSO', 'Identität', 'Benutzer · Rolle · Werkmitgliedschaft', 'OIDC'], ['WM360', 'Abgeleiteter Store', 'Ausnahmen · Zuweisungen · Bestätigungen', 'Von dieser App verwaltet']],
};

const SOURCE_LABEL = { sap: 'connected_plant_uat.sap', central: 'published_uat.central_services' };
const SOURCE_COLOR = { sap: 'var(--valentia-slate)', central: 'var(--forest)' };

const DocsTabs = ({ current, onChange }: { current: string; onChange: (id: string) => void }) => {
  const { t } = useI18n();
  return (
    <div className="docs-tabs">
      {[
        { id: 'concept', label: t('warehouse.docs.tab.concept'), icon: 'lightning' },
        { id: 'kpis', label: t('warehouse.docs.tab.kpis'), icon: 'chart' },
        { id: 'data', label: t('warehouse.docs.tab.data'), icon: 'layers' },
      ].map((tab) => (
        <button key={tab.id} className={`docs-tab ${current === tab.id ? 'is-active' : ''}`} onClick={() => onChange(tab.id)}>
          <Icon name={tab.icon} size={14}/>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

const DocConcept = () => {
  const { t, language } = useI18n();
  const copy = mergeCopy(language);

  return (
    <div className="doc stack-16">
      <div className="doc-hero">
        <div className="t-eyebrow">{t('warehouse.docs.concept.eyebrow')}</div>
        <h2 className="doc-hero-title">{t('warehouse.docs.concept.title')}</h2>
        <p className="doc-hero-lede">{t('warehouse.docs.concept.lede')}</p>
        <div className="doc-hero-meta">
          <div><div className="t-eyebrow">{t('warehouse.docs.concept.meta.pilot')}</div><div>Kerry Naas · IE01 · WH NS01</div></div>
          <div><div className="t-eyebrow">{t('warehouse.docs.concept.meta.source')}</div><div>SAP ECC · EWM · MII</div></div>
          <div><div className="t-eyebrow">{t('warehouse.docs.concept.meta.refresh')}</div><div>{t('warehouse.docs.concept.meta.refreshValue')}</div></div>
          <div><div className="t-eyebrow">{t('warehouse.docs.concept.meta.users')}</div><div>{t('warehouse.docs.concept.meta.usersValue')}</div></div>
        </div>
      </div>

      <div className="grid-2">
        <Card title={t('warehouse.docs.concept.problem.title')} eyebrow={t('warehouse.docs.concept.problem.eyebrow')}>
          <p>{copy.problemBody}</p>
          <ul className="doc-list">{copy.problemBullets.map(([title, body]) => <li key={title}><b>{title}</b> {body}</li>)}</ul>
        </Card>
        <Card title={t('warehouse.docs.concept.thesis.title')} eyebrow={t('warehouse.docs.concept.thesis.eyebrow')}>
          <p>{copy.thesisBody}</p>
          <ul className="doc-list">{copy.thesisBullets.map((item) => <li key={item}>{item}</li>)}</ul>
        </Card>
      </div>

      <Card title={t('warehouse.docs.concept.personas.title')} eyebrow={t('warehouse.docs.concept.personas.eyebrow')}>
        <div className="persona-grid">
          {copy.personas.map(([name, role, initials, tone, goals, pain, kpi]) => (
            <div key={name} className="persona">
              <div className={`persona-avatar is-${tone}`}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div className="persona-name">{name}</div>
                <div className="persona-role">{role}</div>
                <div className="persona-goal"><b>{copy.labels.goal}</b> {goals}</div>
                <div className="persona-quote">{pain}</div>
                <div className="persona-kpi"><b>{copy.labels.kpis}</b> {kpi}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('warehouse.docs.concept.principles.title')} eyebrow={t('warehouse.docs.concept.principles.eyebrow')}>
        <div className="principle-grid">
          {copy.principles.map(([n, heading, body]) => (
            <div key={n} className="principle">
              <div className="principle-n">{n}</div>
              <div className="principle-h">{heading}</div>
              <div className="principle-p">{body}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid-asym">
        <Card title={t('warehouse.docs.concept.scope.in.title')} eyebrow={t('warehouse.docs.concept.scope.in.eyebrow')}>
          <ul className="doc-list tight">{copy.scopeIn.map((item) => <li key={item}>{item}</li>)}</ul>
        </Card>
        <Card title={t('warehouse.docs.concept.scope.out.title')} eyebrow={t('warehouse.docs.concept.scope.out.eyebrow')}>
          <ul className="doc-list tight">{copy.scopeOut.map((item) => <li key={item}>{item}</li>)}</ul>
        </Card>
      </div>

      <Card title={t('warehouse.docs.concept.release.title')} eyebrow={t('warehouse.docs.concept.release.eyebrow')}>
        <div className="roadmap">
          {copy.roadmap.map(([phase, name, when, what, tone]) => (
            <div key={phase} className={`roadmap-phase is-${tone}`}>
              <div className="roadmap-badge">{phase}</div>
              <div className="roadmap-name">{name}</div>
              <div className="roadmap-when">{when}</div>
              <div className="roadmap-what">{what}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const buildKpiCatalogue = (copy, roles) => kpiLayout.map((indices, domainIndex) => ({
  domain: copy.kpi.domains[domainIndex],
  tone: tones[domainIndex],
  kpis: indices.map((metricIndex) => {
    const [target, freq, source, owners] = kpiMeta[metricIndex];
    return {
      name: copy.kpi.names[metricIndex],
      formula: copy.kpi.formulas[metricIndex],
      target,
      freq: copy.kpi.freqs[freq],
      source,
      owners: owners.map((owner) => roles[owner]).join(' · '),
    };
  }),
}));

const DocKPIs = () => {
  const { language } = useI18n();
  const copy = mergeCopy(language);
  const roles = roleCopy[language] ?? roleCopy.en;
  const catalogue = React.useMemo(() => buildKpiCatalogue(copy, roles), [copy, roles]);
  const [q, setQ] = React.useState('');
  const filtered = catalogue.map((domain) => ({
    ...domain,
    kpis: domain.kpis.filter((kpi) => !q || `${kpi.name} ${kpi.formula} ${kpi.source} ${kpi.owners}`.toLowerCase().includes(q.toLowerCase())),
  })).filter((domain) => domain.kpis.length);
  const totalCount = catalogue.reduce((sum, domain) => sum + domain.kpis.length, 0);

  return (
    <div className="doc stack-16">
      <div className="doc-hero">
        <div className="t-eyebrow">{copy.kpi.eyebrow.replace('{{count}}', totalCount)}</div>
        <h2 className="doc-hero-title">{copy.kpi.title}</h2>
        <p className="doc-hero-lede">{copy.kpi.lede}</p>
      </div>

      <div className="doc-search">
        <Icon name="search" size={14}/>
        <input placeholder={copy.kpi.search} value={q} onChange={(event) => setQ(event.target.value)}/>
        {q && <button className="btn-ghost-xs" onClick={() => setQ('')}>{copy.labels.clear}</button>}
      </div>

      {filtered.map((domain) => (
        <Card key={domain.domain} title={domain.domain} eyebrow={`${domain.kpis.length} ${domain.kpis.length === 1 ? copy.labels.metric_one : copy.labels.metric_other}`} tight>
          <table className="tbl kpi-tbl">
            <colgroup>
              <col style={{ width: '24%' }}/><col style={{ width: '30%' }}/>
              <col style={{ width: '10%' }}/><col style={{ width: '8%' }}/>
              <col style={{ width: '14%' }}/><col style={{ width: '14%' }}/>
            </colgroup>
            <thead><tr>{copy.kpi.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {domain.kpis.map((kpi) => (
                <tr key={kpi.name}>
                  <td><div className="kpi-name">{kpi.name}</div></td>
                  <td className="kpi-formula">{kpi.formula}</td>
                  <td><span className={`tag tag-${domain.tone === 'sunrise' ? 'forest' : 'slate'}`}>{kpi.target}</span></td>
                  <td className="m">{kpi.freq}</td>
                  <td className="m">{kpi.source}</td>
                  <td>{kpi.owners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      <Card title={copy.kpi.alertTitle} eyebrow={copy.kpi.derived}>
        <div className="alert-rules">
          {copy.kpi.alerts.map(([heading, when, where, whom]) => (
            <div key={heading} className="alert-rule">
              <div className="alert-rule-h"><RiskDot risk="red"/>{heading}</div>
              <div className="alert-rule-when"><b>{copy.labels.when}</b> {when}</div>
              <div className="alert-rule-where"><b>{copy.labels.shownOn}</b> {where}</div>
              <div className="alert-rule-whom"><b>{copy.labels.notifies}</b> {whom}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const DocSapTables = ({ copy }) => {
  const presentCount = sapRows.filter((row) => row[4]).length;
  const missingCount = sapRows.length - presentCount;
  const modules = [...new Set(sapRows.map((row) => row[0]))];

  return (
    <Card title={copy.data.sapTitle} eyebrow={`${presentCount} ${copy.labels.present} · ${missingCount} ${copy.labels.todo}`} tight>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(SOURCE_LABEL).map(([key, label]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: SOURCE_COLOR[key], flexShrink: 0 }}/>
            <span className="mono" style={{ color: 'var(--fg-muted)' }}>{label}</span>
          </span>
        ))}
      </div>
      {modules.map((moduleName) => {
        const rows = sapRows.filter((row) => row[0] === moduleName);
        return (
          <div key={moduleName} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>{moduleName}</div>
            <table className="tbl" style={{ marginBottom: 0 }}>
              <colgroup>
                <col style={{ width: 40 }}/>
                <col style={{ width: '14%' }}/>
                <col style={{ width: '26%' }}/>
                <col/>
              </colgroup>
              <thead><tr><th></th>{copy.data.sapColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>
                {rows.map(([module, table, description, schemaOrTodo, present, source]) => (
                  <tr key={`${module}-${table}`}>
                    <td style={{ textAlign: 'center' }}>
                      {present
                        ? <span style={{ color: 'var(--jade)', fontWeight: 700, fontSize: 13 }}>✓</span>
                        : <span style={{ color: 'var(--sunset)', fontWeight: 700, fontSize: 13 }}>✗</span>}
                    </td>
                    <td><span className="code">{table}</span></td>
                    <td style={{ fontSize: 12 }}>{description}</td>
                    <td style={{ fontSize: 11 }}>
                      {present ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {source && <span style={{ width: 8, height: 8, borderRadius: 1, background: SOURCE_COLOR[source], flexShrink: 0 }}/>}
                          <span className="mono" style={{ color: 'var(--fg-muted)' }}>{schemaOrTodo}</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--sunset)' }}><b>{copy.labels.todo}:</b> {schemaOrTodo}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </Card>
  );
};

const DocData = () => {
  const { language } = useI18n();
  const copy = mergeCopy(language);
  const labels = entityLabels[language] ?? entityLabels.en;
  const rows = fieldRows[language] ?? fieldRows.en;
  const integrationRows = integrations[language] ?? integrations.en;
  const entities = dataEntityMeta.map(([id, sap, colour, attrs, rels], index) => ({ id, label: labels[index], sap, colour, attrs, rels }));

  return (
    <div className="doc stack-16">
      <div className="doc-hero">
        <div className="t-eyebrow">{copy.data.eyebrow}</div>
        <h2 className="doc-hero-title">{copy.data.title}</h2>
        <p className="doc-hero-lede">{copy.data.lede}</p>
        <div className="doc-hero-meta">
          {copy.data.meta.map(([label, value]) => <div key={label}><div className="t-eyebrow">{label}</div><div>{value}</div></div>)}
        </div>
      </div>

      <Card title={copy.data.erTitle} eyebrow={copy.data.erEyebrow} subtitle={copy.data.erSubtitle}>
        <ERDiagram labels={labels}/>
      </Card>

      <div className="grid-2">
        {entities.map((entity) => (
          <div key={entity.id} className={`entity-card is-${entity.colour}`}>
            <div className="entity-card-head">
              <div className="entity-card-title">{entity.label}</div>
              <div className="entity-card-sap">{entity.sap}</div>
            </div>
            <div className="entity-card-section">
              <div className="entity-card-section-h">{copy.labels.attributes}</div>
              <ul className="entity-attrs">
                {entity.attrs.map((attr) => {
                  const [key, meta] = attr.split(/\s+\(/);
                  return <li key={attr}><span className="entity-attr-k">{key}</span>{meta && <span className="entity-attr-v"> ({meta}</span>}</li>;
                })}
              </ul>
            </div>
            <div className="entity-card-section">
              <div className="entity-card-section-h">{copy.labels.relations}</div>
              <ul className="entity-rels">{entity.rels.map((relation) => <li key={relation}>{relation}</li>)}</ul>
            </div>
          </div>
        ))}
      </div>

      <Card title={copy.data.fieldTitle} eyebrow={copy.data.fieldEyebrow} tight>
        <table className="tbl kpi-tbl">
          <colgroup>
            <col style={{ width: '22%' }}/><col style={{ width: '22%' }}/>
            <col style={{ width: '22%' }}/><col style={{ width: '34%' }}/>
          </colgroup>
          <thead><tr>{copy.data.fieldColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[1]}>
                <td><b>{row[0]}</b></td>
                <td className="m">{row[1]}</td>
                <td className="m">{row[2]}</td>
                <td>{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <DocSapTables copy={copy}/>

      <Card title={copy.data.integrationTitle} eyebrow={copy.data.integrationEyebrow}>
        <div className="integration-grid">
          {integrationRows.map(([system, role, pulls, freq]) => (
            <div key={system} className="integration-card">
              <div className="integration-sys">{system}</div>
              <div className="integration-role">{role}</div>
              <div className="integration-pulls">{pulls}</div>
              <div className="integration-freq"><Icon name="refresh" size={10}/> {freq}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const ERDiagram = ({ labels }) => {
  const boxes = [
    { id: 'po', x: 80, y: 210, w: 150, h: 58, label: labels[0], sap: 'AFKO/AFPO', tone: 'forest' },
    { id: 'to', x: 320, y: 210, w: 150, h: 58, label: labels[1], sap: 'LTAK/LTAP', tone: 'slate' },
    { id: 'del', x: 560, y: 80, w: 150, h: 58, label: labels[2], sap: 'LIKP/LIPS', tone: 'sunset' },
    { id: 'rec', x: 560, y: 340, w: 150, h: 58, label: labels[3], sap: 'EKKO/MKPF', tone: 'sage' },
    { id: 'hu', x: 800, y: 210, w: 140, h: 58, label: labels[4], sap: 'VEKP · SSCC', tone: 'valentia' },
    { id: 'qu', x: 800, y: 420, w: 140, h: 58, label: labels[5], sap: 'LQUA', tone: 'jade' },
    { id: 'bin', x: 560, y: 460, w: 150, h: 58, label: labels[6], sap: 'LAGP', tone: 'slate' },
    { id: 'bat', x: 320, y: 80, w: 150, h: 58, label: labels[7], sap: 'MCHA', tone: 'sunrise' },
    { id: 'dsp', x: 80, y: 80, w: 150, h: 58, label: labels[8], sap: 'MII', tone: 'sunset' },
    { id: 'exc', x: 80, y: 420, w: 150, h: 58, label: labels[9], sap: 'Derived', tone: 'sunset' },
    { id: 'mat', x: 320, y: 460, w: 150, h: 58, label: labels[10], sap: 'MARA', tone: 'forest' },
  ];
  const byId = Object.fromEntries(boxes.map((box) => [box.id, box]));
  const cx = (box) => box.x + box.w / 2;
  const cy = (box) => box.y + box.h / 2;
  const curve = (a, b) => {
    const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
    const mx = (ax + bx) / 2;
    return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
  };
  const edges = [
    ['po', 'to', '1..n', 'solid'], ['po', 'bat', '1..n', 'solid'], ['po', 'dsp', '0..n', 'solid'], ['po', 'exc', '0..n', 'dashed'],
    ['to', 'del', '1..n', 'solid'], ['to', 'rec', '0..n', 'solid'], ['to', 'hu', '0..1', 'solid'], ['rec', 'bat', '0..n', 'solid'],
    ['rec', 'hu', '0..n', 'solid'], ['hu', 'qu', '1..n', 'solid'], ['bin', 'qu', '0..n', 'solid'], ['bat', 'qu', '1..1', 'solid'],
    ['mat', 'bat', '1..n', 'solid'], ['exc', 'to', 'polymorphic', 'dashed'],
  ];

  return (
    <div className="er-wrap">
      <svg viewBox="0 0 1020 540" className="er-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--valentia-slate)"/>
          </marker>
          <marker id="arr-dash" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--sunset)"/>
          </marker>
        </defs>
        {edges.map(([from, to, label, style]) => {
          const a = byId[from], b = byId[to];
          const midx = (cx(a) + cx(b)) / 2, midy = (cy(a) + cy(b)) / 2;
          return (
            <g key={`${from}-${to}`}>
              <path d={curve(a, b)} className={`er-edge ${style === 'dashed' ? 'dashed' : ''}`} markerEnd={style === 'dashed' ? 'url(#arr-dash)' : 'url(#arr)'}/>
              <g transform={`translate(${midx},${midy})`}>
                <rect x="-22" y="-8" width="44" height="16" rx="3" fill="white" stroke="var(--stroke-soft)"/>
                <text y="4" textAnchor="middle" className="er-edge-label">{label}</text>
              </g>
            </g>
          );
        })}
        {boxes.map((box) => (
          <g key={box.id} transform={`translate(${box.x},${box.y})`} className={`er-node is-${box.tone}`}>
            <rect width={box.w} height={box.h} rx="6"/>
            <text x="10" y="22" className="er-node-label">{box.label}</text>
            <text x="10" y="40" className="er-node-sap">{box.sap}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const DocsPage = () => {
  const [tab, setTab] = React.useState('concept');
  return (
    <div className="page">
      <DocsTabs current={tab} onChange={setTab}/>
      {tab === 'concept' && <DocConcept/>}
      {tab === 'kpis' && <DocKPIs/>}
      {tab === 'data' && <DocData/>}
    </div>
  );
};

export { DocsPage };
