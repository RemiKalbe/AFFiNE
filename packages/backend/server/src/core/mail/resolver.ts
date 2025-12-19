import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import type { SendMailOptions } from 'nodemailer';

import { BadRequest } from '../../base';
import { Renderers } from '../../mails';
import { CurrentUser } from '../auth/session';
import { Admin } from '../common';
import { formatSender, MailSender } from './sender';

@Admin()
@Resolver(() => Boolean)
export class MailResolver {
  @Mutation(() => Boolean)
  async sendTestEmail(
    @CurrentUser() user: CurrentUser,
    @Args('config', { type: () => GraphQLJSONObject })
    config: AppConfig['mailer']['SMTP']
  ) {
    const smtp = MailSender.create(config);

    using _disposable = {
      [Symbol.dispose]: () => {
        smtp.close();
      },
    };

    try {
      await smtp.verify();
    } catch (e) {
      throw new BadRequest(
        `Failed to verify your SMTP configuration. Cause: ${(e as Error).message}`
      );
    }

    try {
      const from = formatSender(config.sender, config.senderName);
      const mailOptions: SendMailOptions = {
        from,
        to: user.email,
        ...(await Renderers.TestMail({})),
      };
      if (config.envelopeFrom) {
        mailOptions.envelope = { from: config.envelopeFrom, to: user.email };
      }
      await smtp.sendMail(mailOptions);
    } catch (e) {
      throw new BadRequest(
        `Failed to send test email. Cause: ${(e as Error).message}`
      );
    }

    return true;
  }
}
