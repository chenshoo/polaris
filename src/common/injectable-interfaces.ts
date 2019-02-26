import { ApplicationLogProperties, LoggerConfiguration } from '@enigmatis/polaris-logs';
import { IResolvers } from 'graphql-tools';
import { MiddlewaresConfiguration } from '../middlewares/middleware-activation-condition/filter-condition';
import { PolarisProperties } from '../properties/polaris-properties';

export interface InjectableType {
    definition: string;
}

export interface InjectableResolver {
    resolver(): IResolvers;
}

export interface LoggerConfig {
    loggerConfiguration: LoggerConfiguration;
}
export interface MiddlewareConfig {
    middlewaresConfiguration: MiddlewaresConfiguration;
}
export interface PolarisServerConfig {
    polarisProperties: PolarisProperties;
    applicationLogProperties: ApplicationLogProperties;
}
