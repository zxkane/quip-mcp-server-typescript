/**
 * Structured logging for the Quip MCP Server
 * Using Winston logging library
 */
import winston from 'winston';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Map our LogLevel enum to Winston's levels
const levelMap = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error'
};

// Map Winston's levels back to our LogLevel enum
const reverseLevelMap: { [key: string]: LogLevel } = {
  'debug': LogLevel.DEBUG,
  'info': LogLevel.INFO,
  'warn': LogLevel.WARN,
  'error': LogLevel.ERROR
};

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   */
  level: LogLevel;
  
  /**
   * Whether to include timestamps in log output
   */
  timestamps: boolean;
  
  /**
   * Whether to output logs as JSON
   */
  json: boolean;
}

/**
 * Logger class for structured logging using Winston
 */
export class Logger {
  private logger: winston.Logger;
  private context: Record<string, any>;
  
  // Store original console methods
  private originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  
  /**
   * Create a new logger
   * 
   * @param config Logger configuration
   * @param context Additional context to include in all log entries
   */
  constructor(config: Partial<LoggerConfig> = {}, context: Record<string, any> = {}) {
    const level = config.level ?? LogLevel.INFO;
    const shouldUseTimestamps = config.timestamps ?? true;
    const shouldUseJSON = config.json ?? false;
    
    // Create format based on configuration
    let format: winston.Logform.Format;
    
    if (shouldUseJSON) {
      format = winston.format.combine(
        shouldUseTimestamps ? winston.format.timestamp() : winston.format.simple(),
        winston.format.json()
      );
    } else {
      const customFormat = winston.format.printf(({ level, message, timestamp, ...rest }) => {
        const prefix = shouldUseTimestamps && timestamp ? `[${timestamp}] ${level.toUpperCase()}: ` : `${level.toUpperCase()}: `;
        let output = `${prefix}${message}`;
        
        // Add any additional data as JSON
        const additionalData = { ...rest };
        delete additionalData.level;
        delete additionalData.message;
        delete additionalData.timestamp;
        
        if (Object.keys(additionalData).length > 0) {
          output += ` ${JSON.stringify(additionalData)}`;
        }
        
        return output;
      });
      
      format = winston.format.combine(
        shouldUseTimestamps ? winston.format.timestamp() : winston.format.simple(),
        customFormat
      );
    }
    
    // Create winston logger
    this.logger = winston.createLogger({
      level: levelMap[level],
      format: format,
      transports: [
        new winston.transports.Console()
      ]
    });
    
    this.context = context;
  }
  
  /**
   * Create a child logger with additional context
   * 
   * @param context Additional context to include in all log entries
   * @returns New logger instance with combined context
   */
  child(context: Record<string, any>): Logger {
    // Create new logger with the same configuration
    const childLogger = new Logger({
      level: reverseLevelMap[this.logger.level],
      timestamps: true,
      json: false
    }, { ...this.context, ...context });
    
    return childLogger;
  }
  
  /**
   * Log a message at DEBUG level
   * 
   * @param message Log message
   * @param data Additional data to include in the log entry
   */
  debug(message: string, data: Record<string, any> = {}): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  /**
   * Log a message at INFO level
   * 
   * @param message Log message
   * @param data Additional data to include in the log entry
   */
  info(message: string, data: Record<string, any> = {}): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  /**
   * Log a message at WARN level
   * 
   * @param message Log message
   * @param data Additional data to include in the log entry
   */
  warn(message: string, data: Record<string, any> = {}): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  /**
   * Log a message at ERROR level
   * 
   * @param message Log message
   * @param data Additional data to include in the log entry
   */
  error(message: string, data: Record<string, any> = {}): void {
    this.log(LogLevel.ERROR, message, data);
  }
  
  /**
   * Log a message at the specified level
   * 
   * @param level Log level
   * @param message Log message
   * @param data Additional data to include in the log entry
   */
  private log(level: LogLevel, message: string, data: Record<string, any> = {}): void {
    // Skip if level is below configured minimum
    if (level < reverseLevelMap[this.logger.level]) {
      return;
    }
    
    // Build log entry
    const logData: Record<string, any> = {
      message
    };
    
    // Add context and data
    if (Object.keys(this.context).length > 0) {
      logData.context = this.context;
    }
    
    if (Object.keys(data).length > 0) {
      logData.data = data;
    }
    
    // Log using winston - avoid passing message twice
    this.logger.log(levelMap[level], message, { 
      context: logData.context,
      data: logData.data
    });
  }
  
  /**
   * Configure global console methods to use this logger
   */
  installAsGlobal(): void {
    // Override console methods
    console.debug = (message: any, ...args: any[]) => {
      if (typeof message === 'string') {
        this.debug(message, args.length > 0 ? { args } : {});
      } else {
        this.originalConsole.debug(message, ...args);
      }
    };
    
    console.info = (message: any, ...args: any[]) => {
      if (typeof message === 'string') {
        this.info(message, args.length > 0 ? { args } : {});
      } else {
        this.originalConsole.info(message, ...args);
      }
    };
    
    console.warn = (message: any, ...args: any[]) => {
      if (typeof message === 'string') {
        this.warn(message, args.length > 0 ? { args } : {});
      } else {
        this.originalConsole.warn(message, ...args);
      }
    };
    
    console.error = (message: any, ...args: any[]) => {
      if (typeof message === 'string') {
        this.error(message, args.length > 0 ? { args } : {});
      } else {
        this.originalConsole.error(message, ...args);
      }
    };
  }
}

// Create default logger instance
export const logger = new Logger();

/**
 * Configure logger from command line options
 * 
 * @param options Command line options
 * @returns Configured logger instance
 */
export function configureLogger(options: { debug?: boolean, json?: boolean } = {}): Logger {
  const config: Partial<LoggerConfig> = {
    level: options.debug ? LogLevel.DEBUG : LogLevel.INFO,
    json: options.json || false,
    timestamps: true
  };
  
  const newLogger = new Logger(config);
  
  // Install as global logger
  newLogger.installAsGlobal();
  
  return newLogger;
}
