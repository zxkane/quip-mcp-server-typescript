/**
 * Structured logging for the Quip MCP Server
 * Using Winston logging library
 */
import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

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

  /**
   * Path to log file (enables file logging when specified)
   */
  logFile?: string;
  
  /**
   * Maximum size of log file before rotation (default: 10MB)
   */
  maxFileSize?: number;
  
  /**
   * Maximum number of log files to keep (default: 5)
   */
  maxFiles?: number;
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
    const level = config.level ?? LogLevel.WARN;
    const shouldUseTimestamps = config.timestamps ?? true;
    const shouldUseJSON = config.json ?? false;
    const logFile = config.logFile;
    const maxFileSize = config.maxFileSize ?? 10 * 1024 * 1024; // 10MB default
    const maxFiles = config.maxFiles ?? 5;
    
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
    
    // Create transports array
    const transports: winston.transport[] = [
      new winston.transports.Console()
    ];
    
    // Add file transport if logFile is specified
    if (logFile) {
      // Ensure directory exists
      const logDir = path.dirname(logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      transports.push(
        new winston.transports.File({
          filename: logFile,
          maxsize: maxFileSize,
          maxFiles: maxFiles,
          tailable: true
        })
      );
    }
    
    // Create winston logger
    this.logger = winston.createLogger({
      level: levelMap[level],
      format: format,
      transports: transports
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
  
  /**
   * Reconfigure an existing logger with new settings
   * 
   * @param config Logger configuration
   */
  reconfigure(config: Partial<LoggerConfig> = {}): void {
    const level = config.level ?? LogLevel.WARN;
    const shouldUseTimestamps = config.timestamps ?? true;
    const shouldUseJSON = config.json ?? false;
    const logFile = config.logFile;
    const maxFileSize = config.maxFileSize ?? 10 * 1024 * 1024; // 10MB default
    const maxFiles = config.maxFiles ?? 5;
    
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
    
    // Create transports array
    const transports: winston.transport[] = [
      new winston.transports.Console()
    ];
    
    // Add file transport if logFile is specified
    if (logFile) {
      // Ensure directory exists
      const logDir = path.dirname(logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      transports.push(
        new winston.transports.File({
          filename: logFile,
          maxsize: maxFileSize,
          maxFiles: maxFiles,
          tailable: true
        })
      );
    }
    
    // Update winston logger configuration
    this.logger.configure({
      level: levelMap[level],
      format: format,
      transports: transports
    });
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
export function configureLogger(options: { debug?: boolean, json?: boolean, logFile?: string } = {}): Logger {
  const config: Partial<LoggerConfig> = {
    level: options.debug ? LogLevel.DEBUG : LogLevel.WARN,
    json: options.json || false,
    timestamps: true,
    logFile: options.logFile
  };
  
  // Update the existing logger instead of creating a new one
  logger.reconfigure(config);
  
  // Install as global logger
  logger.installAsGlobal();
  
  return logger;
}
