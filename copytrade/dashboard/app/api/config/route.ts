import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Path to the shared config.json file in the root directory
const CONFIG_PATH = path.join(process.cwd(), '../../config.json');

export async function GET() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Failed to read config.json:', error);
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Simple validation
    if (!body || !body.traders || !body.globalSettings) {
        return NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
    }

    await fs.writeFile(CONFIG_PATH, JSON.stringify(body, null, 2), 'utf-8');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to write config.json:', error);
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }
}
