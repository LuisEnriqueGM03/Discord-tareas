export class TimeFormatter {
  static formatMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    }

    return `${hours} hora${hours !== 1 ? 's' : ''} y ${remainingMinutes} minuto${remainingMinutes !== 1 ? 's' : ''}`;
  }

  static formatMilliseconds(ms: number): string {
    const minutes = Math.ceil(ms / 60000);
    return this.formatMinutes(minutes);
  }

  static formatMillisecondsWithSeconds(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days}d`);
    }
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}s`);
    }

    return parts.join(' ');
  }

  static formatDate(date: Date): string {
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static getRemainingMinutes(targetDate: Date): number {
    const now = Date.now();
    const target = new Date(targetDate).getTime();
    const remainingMs = target - now;
    return Math.max(0, Math.ceil(remainingMs / 60000));
  }

  static getRemainingTime(targetDate: Date): { minutes: number; seconds: number; totalMs: number } {
    const now = Date.now();
    const target = new Date(targetDate).getTime();
    const remainingMs = Math.max(0, target - now);
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds, totalMs: remainingMs };
  }
}
