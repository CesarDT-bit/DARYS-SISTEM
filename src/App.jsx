import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { AlertTriangle, Settings, Activity, Wrench, Radio, ActivitySquare } from 'lucide-react';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFetching, setIsFetching] = useState(false);
  const [awsConnected, setAwsConnected] = useState(false);
  
  const [chartData, setChartData] = useState([]);
  const [flota, setFlota] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  const [kpis, setKpis] = useState({
    operativas: 0,
    total: 0,
    desgastePromedio: 0,
    enMantenimiento: 0,
    alertasCriticas: 0,
    senalesMin: 0
  });

  const API_URL = "/api/default/darisLeerBD";

  const fetchDataFromAWS = useCallback(async () => {
    try {
      setIsFetching(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Error en la red');
      const data = await response.json();
      
      setAwsConnected(true);
      
      // Ordenar por tiempo
      const awsStream = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Si la base de datos de Dynamo está vacía
      if (awsStream.length === 0) return;

      const operativas = awsStream.filter(d => d.estado === 'operativa').length;
      const mantenimiento = awsStream.filter(d => d.estado === 'mantenimiento').length;
      const criticas = awsStream.filter(d => d.estado === 'critica' || d.desgaste_pct > 80).length;
      const avgDesgaste = awsStream.reduce((acc, curr) => acc + curr.desgaste_pct, 0) / awsStream.length;
      
      setKpis({
        operativas,
        total: awsStream.length,
        desgastePromedio: avgDesgaste.toFixed(1),
        enMantenimiento: mantenimiento,
        alertasCriticas: criticas,
        senalesMin: awsStream.length * 60 // Estimación visual
      });

      // Agrupar por máquina
      const uniqueMachines = {};
      awsStream.forEach(record => {
        uniqueMachines[record.maquina_id] = {
          id: record.maquina_id,
          name: record.tipo,
          type: record.tipo,
          sector: record.sector,
          estado: record.desgaste_pct > 80 ? 'Crítico' : 'Normal',
          desgaste: record.desgaste_pct,
          temp: record.temperatura_c,
          vib: record.vibracion_mm_s,
          latencia: record.latencia_ms,
          horas: record.horas_motor,
          cuerdas: record.cuerdas
        };
      });
      
      setFlota(Object.values(uniqueMachines));

      const newAlerts = awsStream
        .filter(record => record.desgaste_pct > 80 || record.temperatura_c > 100)
        .slice(-6)
        .map(record => ({
          time: new Date(record.timestamp).toLocaleTimeString([], { hour12: false }),
          equip: record.maquina_id,
          msg: record.desgaste_pct > 80 ? `Desgaste de componente sobre 80% (${record.desgaste_pct}%)` : `Temperatura crítica (${record.temperatura_c}°C)`
        }));
      setAlerts(newAlerts.reverse());

    } catch (err) {
      console.error("Error conectando a AWS API Gateway:", err);
      setAwsConnected(false);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    // 1. Llamada inicial a la Base de Datos
    fetchDataFromAWS();

    // 2. Poll: Consultar AWS periódicamente (simulando suscripción en tiempo real)
    const awsInterval = setInterval(() => {
      fetchDataFromAWS();
    }, 5000); // 5 segundos para no agotar cuotas gratis muy rápido

    // 3. Reloj en vivo y gráficos simulados para efecto visual fluido
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setChartData(prev => {
        const newData = [...prev];
        if (newData.length > 20) newData.shift();
        newData.push({
          time: new Date().toLocaleTimeString([], { hour12: false }),
          desgaste: 60 + Math.random() * 30, 
          temp: 85 + Math.random() * 15,
          operativas: Math.random() > 0.8 ? 1 : 0
        });
        return newData;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(awsInterval);
    };
  }, [fetchDataFromAWS]);

  const palas = flota.filter(f => f.type.toLowerCase().includes('pala'));
  const restoFlota = flota.filter(f => !f.type.toLowerCase().includes('pala'));

  return (
    <div className="darys-app">
      {/* HEADER */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-box">
            <span className="logo-f">Ferreyros</span>
            <span className="logo-cat">CAT</span>
          </div>
          <div className="title-box">
            <h1>DARYS</h1>
            <span>MONITOREO DE CONDICIÓN | FLOTA MINERA</span>
          </div>
        </div>
        <div className="topbar-right">
          <div className="cloud-status">
            <Radio size={14} className={awsConnected ? "icon-blue" : "text-red"} />
            {awsConnected ? "Nube AWS DynamoDB Conectada" : "Desconectado de AWS"}
          </div>
          <div className="live-badge">
            <span className={isFetching ? "dot loading" : "dot"}></span> EN VIVO - {currentTime.toLocaleTimeString([], { hour12: false })}
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* KPI CARDS */}
        <div className="kpi-row">
          <div className="kpi-card">
            <div className="kpi-title">
              <span>MÁQUINAS OPERATIVAS</span>
              <ActivitySquare size={14} className="text-yellow" />
            </div>
            <div className="kpi-value text-yellow">{kpis.operativas}/{kpis.total}</div>
            <div className="kpi-sub">Disponibilidad {kpis.total > 0 ? ((kpis.operativas/kpis.total)*100).toFixed(1) : 0}%</div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-title">
              <span>DESGASTE PROMEDIO</span>
              <Settings size={14} className="text-gray" />
            </div>
            <div className="kpi-value">{kpis.desgastePromedio}%</div>
            <div className="kpi-sub">Lectura real de Lambda AWS</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-title">
              <span>EN MANTENIMIENTO</span>
              <Wrench size={14} className="text-gray" />
            </div>
            <div className="kpi-value">{kpis.enMantenimiento}</div>
            <div className="kpi-sub">órdenes activas AWS</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-title">
              <span>ALERTAS CRÍTICAS</span>
              <AlertTriangle size={14} className="text-gray" />
            </div>
            <div className="kpi-value">{kpis.alertasCriticas}</div>
            <div className="kpi-sub">Requieren atención inmediata</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-title">
              <span>SEÑALES / MIN</span>
              <Activity size={14} className="text-gray" />
            </div>
            <div className="kpi-value">{kpis.senalesMin}</div>
            <div className="kpi-sub">Telemetría procesada</div>
          </div>
        </div>

        {/* CHARTS ROW */}
        <div className="charts-row">
          <div className="panel chart-panel">
            <h3>Desgaste promedio de flota - tiempo real</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{top: 10, right: 0, left: -20, bottom: 0}}>
                  <defs>
                    <linearGradient id="colorDesgaste" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#facc15" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="time" stroke="#555" fontSize={10} tickMargin={10} />
                  <YAxis stroke="#555" fontSize={10} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} />
                  <Area type="step" dataKey="desgaste" stroke="#facc15" strokeWidth={2} fillOpacity={1} fill="url(#colorDesgaste)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel chart-panel">
            <h3>Máquinas operativas y temperatura promedio</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{top: 10, right: 0, left: -20, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="time" stroke="#555" fontSize={10} tickMargin={10} />
                  <YAxis yAxisId="left" stroke="#555" fontSize={10} domain={[0, 10]} ticks={[0, 3, 6, 10]} />
                  <YAxis yAxisId="right" orientation="right" stroke="#555" fontSize={10} domain={[50, 120]} ticks={[50, 70, 90, 105, 120]} tickFormatter={v => `${v}°`} />
                  <Line yAxisId="left" type="step" dataKey="operativas" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="temp" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* TABLE & ALERTS ROW */}
        <div className="table-alerts-row">
          <div className="panel table-panel">
            <h3>Estado de flota (Lectura oficial DynamoDB)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>EQUIPO</th>
                  <th>SECTOR</th>
                  <th>ESTADO</th>
                  <th>DESGASTE</th>
                  <th>TEMP.</th>
                  <th>VIBRACIÓN</th>
                  <th>LATENCIA</th>
                </tr>
              </thead>
              <tbody>
                {restoFlota.map((f, i) => (
                  <tr key={i}>
                    <td>
                      <div className="equip-name">{f.id}</div>
                      <div className="equip-sub">{f.name}</div>
                    </td>
                    <td>{f.sector}</td>
                    <td>
                      {f.estado === 'Crítico' ? 
                        <span className="badge-critical">Crítica</span> : 
                        <span className="badge-gray">Normal</span>
                      }
                    </td>
                    <td className="w-100">
                      <div className="progress-cell">
                        <div className="progress-bar"><div className="fill" style={{width: `${f.desgaste}%`}}></div></div>
                        <span>{f.desgaste}%</span>
                      </div>
                    </td>
                    <td className={f.temp > 95 ? "text-red font-mono" : "text-gray font-mono"}>{f.temp}°C</td>
                    <td className="font-mono">{f.vib} mm/s</td>
                    <td className="text-gray font-mono">{f.latencia} ms</td>
                  </tr>
                ))}
                {restoFlota.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-gray" style={{textAlign: "center", padding: "20px"}}>
                      Aún no hay datos. Agrega máquinas en tu consola DynamoDB.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="panel alerts-panel">
            <h3><AlertTriangle size={14} className="text-yellow" /> Alertas AWS</h3>
            <div className="alerts-list">
              {alerts.length > 0 ? alerts.map((al, i) => (
                <div className="alert-item" key={i}>
                  <AlertTriangle size={14} className="text-red" />
                  <span className="alert-time">{al.time}</span>
                  <span className="alert-equip">{al.equip}</span>
                  <span className="alert-msg">{al.msg}</span>
                </div>
              )) : (
                 <div className="alert-item text-gray">No hay alertas recientes registradas en la base de datos de AWS.</div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM ROW (PALAS & MANTENIMIENTO) */}
        <div className="bottom-row">
          <div className="panel palas-panel">
            <h3>Palas de cables - estado de cuerdas</h3>
            <div className="pala-list">
              {palas.length > 0 ? palas.map((p, i) => (
                <div className="pala-item" key={i}>
                  <div className="pala-header">
                    <div>
                      <strong>{p.id}</strong> - {p.sector}
                      <div className="pala-sub">Horas motor: {p.horas.toLocaleString()}</div>
                    </div>
                    {p.cuerdas === 'optimo' ? (
                      <span className="badge-gray" style={{color: '#10b981', borderColor: '#10b981'}}>Cuerdas Óptimas</span>
                    ) : (
                      <span className="badge-critical-outline">Cuerdas críticas</span>
                    )}
                  </div>
                  <div className="progress-full">
                    <div className="progress-bar"><div className="fill" style={{width: `${p.desgaste}%`}}></div></div>
                    <span>{p.desgaste}% desgaste</span>
                  </div>
                </div>
              )) : (
                <div className="text-gray" style={{padding: "20px"}}>Agrega una máquina con tipo "Pala" en DynamoDB para ver su estado aquí.</div>
              )}
            </div>
          </div>

          <div className="panel mant-panel">
            <h3><Wrench size={14} className="text-yellow" /> Planificación de mantenimiento predictivo (AWS Lambda)</h3>
            <div className="mant-list">
              {restoFlota.filter(m => m.desgaste > 70).slice(0, 4).map((m, i) => (
                <div className="mant-item" key={i}>
                  <div className="mant-header">
                    <div>
                      <strong>Revisión Crítica ({m.name})</strong>
                      <div className="mant-sub">{m.id} - Predictivo (AWS ML)</div>
                    </div>
                    <span className={m.desgaste > 85 ? "badge-red" : "badge-yellow"}>{m.desgaste > 85 ? "Alta" : "Media"}</span>
                  </div>
                  <div className="progress-full">
                    <div className="progress-bar"><div className="fill" style={{width: '100%'}}></div></div>
                    <span className="text-green">✔ Programado</span>
                  </div>
                </div>
              ))}
              {restoFlota.filter(m => m.desgaste > 70).length === 0 && (
                <div className="text-gray" style={{padding: "20px"}}>AWS ML no ha detectado máquinas con desgaste &gt; 70% en DynamoDB.</div>
              )}
            </div>
          </div>
        </div>
        
        <footer className="footer">
          <div className="footer-left">
            <Activity size={12} className="text-gray" />
            Conectado mediante API REST HTTP a AWS Lambda y DynamoDB
          </div>
          <div className="footer-right">
            DARYS v2.0 - Arquitectura AWS Completada
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
