// daynight.js — timezone read, world state, twilight transitions

const DAY_START = 6;   // 6am
const DAY_END = 18;    // 6pm
const TWILIGHT_MINUTES = 10;

export class DayNight {
  constructor() {
    this._sessionHour = new Date().getHours();
    this._sessionMinute = new Date().getMinutes();
    this.isNight = this._calcIsNight();
    this.twilightAlpha = this._calcTwilightAlpha();
    this.isGoldenHour = this._calcGoldenHour();
  }

  _calcIsNight() {
    const h = this._sessionHour;
    return h < DAY_START || h >= DAY_END;
  }

  _calcTwilightAlpha() {
    const h = this._sessionHour;
    const m = this._sessionMinute;
    const totalMinutes = h * 60 + m;

    const dawnStart = DAY_START * 60 - TWILIGHT_MINUTES;
    const dawnEnd   = DAY_START * 60 + TWILIGHT_MINUTES;
    const duskStart = DAY_END * 60 - TWILIGHT_MINUTES;
    const duskEnd   = DAY_END * 60 + TWILIGHT_MINUTES;

    if (totalMinutes >= dawnStart && totalMinutes <= dawnEnd) {
      return 1 - Math.abs(totalMinutes - DAY_START * 60) / TWILIGHT_MINUTES;
    }
    if (totalMinutes >= duskStart && totalMinutes <= duskEnd) {
      return 1 - Math.abs(totalMinutes - DAY_END * 60) / TWILIGHT_MINUTES;
    }
    return 0;
  }

  _calcGoldenHour() {
    const h = this._sessionHour;
    const m = this._sessionMinute;
    const total = h * 60 + m;
    const dawnWindow = Math.abs(total - DAY_START * 60) <= TWILIGHT_MINUTES;
    const duskWindow = Math.abs(total - DAY_END * 60) <= TWILIGHT_MINUTES;
    return dawnWindow || duskWindow;
  }

  isPostMidnight() {
    return this._sessionHour >= 0 && this._sessionHour < 4;
  }
}
