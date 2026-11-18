import type {Storyboard} from '../engine/types';
import {moneyHappiness} from './money-happiness/storyboard';
import {lotteryWinners} from './lottery-winners/storyboard';
// @new-project-import

export const projects: Storyboard[] = [moneyHappiness, lotteryWinners];
