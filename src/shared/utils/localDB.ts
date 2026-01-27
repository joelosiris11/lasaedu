// Mock Database usando localStorage con estructura similar a Firebase
export class LocalDB {
  private prefix = 'lasaedu_db_';

  // Obtener datos de una tabla
  get<T>(table: string): T[] {
    const data = localStorage.getItem(`${this.prefix}${table}`);
    return data ? JSON.parse(data) : [];
  }

  // Alias para compatibilidad - obtener colección completa
  getCollection<T>(table: string): T[] {
    return this.get<T>(table);
  }

  // Obtener un registro por ID
  getById<T extends { id: string }>(table: string, id: string): T | null {
    const data = this.get<T>(table);
    return data.find(item => item.id === id) || null;
  }

  // Establecer datos completos de una tabla
  set(table: string, data: unknown[]): void {
    localStorage.setItem(`${this.prefix}${table}`, JSON.stringify(data));
  }

  // Agregar un nuevo registro (alias: create)
  add<T extends { id?: string }>(table: string, record: T): T & { id: string } {
    const data = this.get<T & { id: string }>(table);
    const newRecord = {
      ...record,
      id: record.id || this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as T & { id: string };
    
    data.push(newRecord);
    this.set(table, data);
    return newRecord;
  }

  // Alias para add - crear registro
  create<T extends { id?: string }>(table: string, record: T): T & { id: string } {
    return this.add(table, record);
  }

  // Actualizar un registro
  update<T extends { id: string }>(table: string, id: string, updates: Partial<T>): T | null {
    const data = this.get<T>(table);
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) return null;
    
    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: Date.now()
    } as T;
    
    this.set(table, data);
    return data[index];
  }

  // Eliminar un registro
  delete(table: string, id: string): boolean {
    const data = this.get<{ id: string }>(table);
    const filtered = data.filter(item => item.id !== id);
    
    if (filtered.length === data.length) return false;
    
    this.set(table, filtered);
    return true;
  }

  // Buscar registros
  search<T extends Record<string, unknown>>(table: string, fields: string[], query: string): T[] {
    const data = this.get<T>(table);
    const lowerQuery = query.toLowerCase();
    return data.filter(item => 
      fields.some(field => {
        const value = item[field];
        return typeof value === 'string' && value.toLowerCase().includes(lowerQuery);
      })
    );
  }

  // Filtrar registros con predicado
  where<T>(table: string, predicate: (item: T) => boolean): T[] {
    return this.get<T>(table).filter(predicate);
  }

  // Contar registros
  count(table: string): number {
    return this.get(table).length;
  }

  // Limpiar tabla
  clear(table: string): void {
    localStorage.removeItem(`${this.prefix}${table}`);
  }

  // Limpiar toda la base de datos
  clearAll(): void {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
    keys.forEach(key => localStorage.removeItem(key));
  }

  // Generar ID único
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Obtener estadísticas
  getStats(table: string) {
    const data = this.get(table);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    return {
      total: data.length,
      today: data.filter((item: any) => 
        item.createdAt && (now - item.createdAt) < dayMs
      ).length,
      thisWeek: data.filter((item: any) => 
        item.createdAt && (now - item.createdAt) < weekMs
      ).length,
      thisMonth: data.filter((item: any) => 
        item.createdAt && (now - item.createdAt) < monthMs
      ).length
    };
  }
}

export const localDB = new LocalDB();