import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import fs from 'fs';

// Lee tus 1000 datos locales
const rawData = fs.readFileSync('./src/data.json');
const awsData = JSON.parse(rawData);

// Configura tus credenciales y región aquí para que funcione sin instalar el AWS CLI
const client = new DynamoDBClient({
  region: "us-east-1", // Cambia a tu región (ej. us-west-2, sa-east-1) si es distinta
  credentials: {
    accessKeyId: "TU_ACCESS_KEY",
    secretAccessKey: "TU_SECRET_KEY"
  }
});

async function simularEnvio() {
  console.log("Iniciando simulación de sensores IoT de DARIS a AWS DynamoDB...");

  for (const registro of awsData) {
    const params = {
      TableName: "DarisTelemetry",
      Item: {
        sector: { S: registro.sector },
        timestamp: { S: new Date().toISOString() }, // Timestamp real del momento de envío
        maquina_id: { S: registro.maquina_id },
        tipo: { S: registro.tipo },
        estado: { S: registro.estado },
        desgaste_pct: { N: registro.desgaste_pct.toString() },
        temperatura_c: { N: registro.temperatura_c.toString() },
        vibracion_mm_s: { N: registro.vibracion_mm_s.toString() },
        horas_motor: { N: registro.horas_motor.toString() },
        latencia_ms: { N: registro.latencia_ms.toString() },
        cuerdas: { S: registro.cuerdas || "N/A" }
      }
    };

    try {
      await client.send(new PutItemCommand(params));
      console.log(`[${new Date().toLocaleTimeString()}] ✔ Entregado a DynamoDB -> ${registro.maquina_id} en ${registro.sector} (Desgaste: ${registro.desgaste_pct}%)`);
    } catch (err) {
      console.error("Error enviando a AWS DynamoDB:", err.message);
    }

    // Esperar 1 segundo antes de enviar el siguiente para simular telemetría en vivo
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

simularEnvio();
