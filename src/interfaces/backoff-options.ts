/**
 * Settings for backing off failed jobs.
 *
 */
export interface BackoffOptions {
  /**
   * Name of the backoff strategy.
   */
  type: 'fixed' | 'exponential' | (string & {});
  /**
   * Delay in milliseconds.
   */
  delay?: number;
}
