import { MysqlUserRepository } from './mysql/MysqlUserRepository';
import { MysqlEmailRepository } from './mysql/MysqlEmailRepository';
import { MysqlSlackRepository } from './mysql/MysqlSlackRepository';

export const userRepository = new MysqlUserRepository();
export const emailRepository = new MysqlEmailRepository();
export const slackRepository = new MysqlSlackRepository();

export * from './types';
