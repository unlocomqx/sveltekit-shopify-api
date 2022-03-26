import { StatusCode } from "@shopify/network"
import { RequestEvent } from "@sveltejs/kit/types/private"
import { createHmac } from "crypto"
import { AuthConfig } from "../auth/oauth/types"
import { ApiVersion, ShopifyHeader } from "../base-types"

import { GraphqlClient } from "../clients/graphql/graphql_client"
import * as ShopifyErrors from "../error"
import ShopifyUtilities from "../utils"

import {
  DeliveryMethod,
  RegisterOptions,
  RegisterReturn,
  ShortenedRegisterOptions,
  WebhookCheckResponse,
  WebhookRegistryEntry,
} from "./types"

interface AddHandlersProps {
  [topic: string]: WebhookRegistryEntry;
}

interface RegistryInterface {
  webhookRegistry: { [topic: string]: WebhookRegistryEntry };

  /**
   * Sets the handler for the given topic. If a handler was previously set for the same topic, it will be overridden.
   *
   * @param topic String used to add a handler
   * @param options Paramters to add a handler which are path and webHookHandler
   */
  addHandler (topic: string, options: WebhookRegistryEntry): void;

  /**
   * Sets a list of handlers for the given topics using the `addHandler` function
   *
   * @param handlers Object in format {topic: WebhookRegistryEntry}
   */
  addHandlers (handlers: AddHandlersProps): void;

  /**
   * Fetches the handler for the given topic. Returns null if no handler was registered.
   *
   * @param topic The topic to check
   */
  getHandler (topic: string): WebhookRegistryEntry | null;

  /**
   * Gets all topics
   */
  getTopics (): string[];

  /**
   * Registers a Webhook Handler function for a given topic.
   *
   * @param options Parameters to register a handler, including topic, listening address, delivery method
   */
  register (config: AuthConfig, options: RegisterOptions): Promise<RegisterReturn>;

  /**
   * Registers multiple Webhook Handler functions.
   *
   * @param options Parameters to register a handler, including topic, listening address, delivery method
   */
  registerAll (config: AuthConfig, options: ShortenedRegisterOptions): Promise<RegisterReturn>;

  /**
   * Processes the webhook request received from the Shopify API
   *
   * @param request HTTP request received from Shopify
   * @param response HTTP response to the request
   */
  process (
    config: AuthConfig,
    event: RequestEvent
  ): Promise<Response>;

  /**
   * Confirms that the given path is a webhook path
   *
   * @param string path component of a URI
   */
  isWebhookPath (path: string): boolean;
}

function isSuccess (
  result: any,
  deliveryMethod: DeliveryMethod,
  webhookId?: string,
): boolean {
  let endpoint
  switch (deliveryMethod) {
    case DeliveryMethod.Http:
      endpoint = "webhookSubscription"
      break
    case DeliveryMethod.EventBridge:
      endpoint = "eventBridgeWebhookSubscription"
      break
    case DeliveryMethod.PubSub:
      endpoint = "pubSubWebhookSubscription"
      break
    default:
      return false
  }
  endpoint += webhookId ? "Update" : "Create"
  return Boolean(
    result.data &&
    result.data[endpoint] &&
    result.data[endpoint].webhookSubscription,
  )
}

function versionSupportsPubSub (config: AuthConfig) {
  return ShopifyUtilities.versionCompatible(ApiVersion.July21, config.API_VERSION)
}

function validateDeliveryMethod (config: AuthConfig, deliveryMethod: DeliveryMethod) {
  if (deliveryMethod === DeliveryMethod.PubSub && !versionSupportsPubSub(config)) {
    throw new ShopifyErrors.UnsupportedClientType(
      `Pub/Sub webhooks are not supported in API version "${ config.API_VERSION }".`,
    )
  }
}

function buildCheckQuery (config: AuthConfig, topic: string): string {
  return `{
    webhookSubscriptions(first: 1, topics: ${ topic }) {
      edges {
        node {
          id
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
            ... on WebhookEventBridgeEndpoint {
              arn
            }
            ${
    versionSupportsPubSub(config)
      ? "... on WebhookPubSubEndpoint { \
                    pubSubProject \
                    pubSubTopic \
                  }"
      : ""
  }
          }
        }
      }
    }
  }`
}

function buildQuery (
  config: AuthConfig,
  topic: string,
  address: string,
  deliveryMethod: DeliveryMethod = DeliveryMethod.Http,
  webhookId?: string,
): string {
  validateDeliveryMethod(config, deliveryMethod)
  let identifier: string
  if (webhookId) {
    identifier = `id: "${ webhookId }"`
  } else {
    identifier = `topic: ${ topic }`
  }

  let mutationName: string
  let webhookSubscriptionArgs: string
  let pubSubProject: string
  let pubSubTopic: string
  switch (deliveryMethod) {
    case DeliveryMethod.Http:
      mutationName = webhookId
        ? "webhookSubscriptionUpdate"
        : "webhookSubscriptionCreate"
      webhookSubscriptionArgs = `{callbackUrl: "${ address }"}`
      break
    case DeliveryMethod.EventBridge:
      mutationName = webhookId
        ? "eventBridgeWebhookSubscriptionUpdate"
        : "eventBridgeWebhookSubscriptionCreate"
      webhookSubscriptionArgs = `{arn: "${ address }"}`
      break
    case DeliveryMethod.PubSub:
      mutationName = webhookId
        ? "pubSubWebhookSubscriptionUpdate"
        : "pubSubWebhookSubscriptionCreate";
      [pubSubProject, pubSubTopic] = address
        .replace(/^pubsub:\/\//, "")
        .split(":")
      webhookSubscriptionArgs = `{pubSubProject: "${ pubSubProject }",
                                  pubSubTopic: "${ pubSubTopic }"}`
      break
  }

  return `
    mutation webhookSubscription {
      ${ mutationName }(${ identifier }, webhookSubscription: ${ webhookSubscriptionArgs }) {
        userErrors {
          field
          message
        }
        webhookSubscription {
          id
        }
      }
    }
  `
}

const WebhooksRegistry: RegistryInterface = {
  webhookRegistry: {},

  addHandler (
    topic: string,
    { path, webhookHandler }: WebhookRegistryEntry,
  ): void {
    WebhooksRegistry.webhookRegistry[topic] = { path, webhookHandler }
  },

  addHandlers (handlers: AddHandlersProps): void {
    for (const topic in handlers) {
      if ({}.hasOwnProperty.call(handlers, topic)) {
        WebhooksRegistry.addHandler(topic, handlers[topic])
      }
    }
  },

  getHandler (topic: string): WebhookRegistryEntry | null {
    return WebhooksRegistry.webhookRegistry[topic] ?? null
  },

  getTopics (): string[] {
    return Object.keys(WebhooksRegistry.webhookRegistry)
  },

  async register (config: AuthConfig, {
    path,
    topic,
    accessToken,
    shop,
    deliveryMethod = DeliveryMethod.Http,
  }: RegisterOptions): Promise<RegisterReturn> {
    const registerReturn: RegisterReturn = {}
    validateDeliveryMethod(config, deliveryMethod)
    const client = new GraphqlClient(config, shop, accessToken)
    const address =
      deliveryMethod === DeliveryMethod.Http
        ? `https://${ config.HOST_NAME }${ path }`
        : path
    const checkResult = (await client.query(config, {
      data: buildCheckQuery(config, topic),
    })) as { body: WebhookCheckResponse }
    let webhookId: string | undefined
    let mustRegister = true
    if (checkResult.body.data.webhookSubscriptions.edges.length) {
      const { node } = checkResult.body.data.webhookSubscriptions.edges[0]
      let endpointAddress = ""
      if (node.endpoint.__typename === "WebhookHttpEndpoint") {
        endpointAddress = node.endpoint.callbackUrl
      } else if (node.endpoint.__typename === "WebhookEventBridgeEndpoint") {
        endpointAddress = node.endpoint.arn
      }

      webhookId = node.id
      if (endpointAddress === address) {
        mustRegister = false
      }
    }

    if (mustRegister) {
      const result = await client.query(config, {
        data: buildQuery(config, topic, address, deliveryMethod, webhookId),
      })
      registerReturn[topic] = {
        success: isSuccess(result.body, deliveryMethod, webhookId),
        result : result.body,
      }
    } else {
      registerReturn[topic] = {
        success: true,
        result : {},
      }
    }
    return registerReturn
  },

  async registerAll (config: AuthConfig, {
    accessToken,
    shop,
    deliveryMethod = DeliveryMethod.Http,
  }: ShortenedRegisterOptions): Promise<RegisterReturn> {
    let registerReturn = {}
    const topics = WebhooksRegistry.getTopics()

    for (const topic of topics) {
      const handler = WebhooksRegistry.getHandler(topic)
      if (handler) {
        const { path } = handler
        const webhook: RegisterOptions = {
          path,
          topic,
          accessToken,
          shop,
          deliveryMethod,
        }
        const returnedRegister = await WebhooksRegistry.register(config, webhook)
        registerReturn = { ...registerReturn, ...returnedRegister }
      }
    }
    return registerReturn
  },

  async process (
    config: AuthConfig,
    event: RequestEvent
  ): Promise<Response> {
    const { request } = event

    const body = await event.request.text()

    const promise: Promise<Response> = new Promise(async (resolve, reject) => {
      if (!body) {
        return reject(
          new ShopifyErrors.InvalidWebhookError(
            "No body was received when processing webhook",
          ),
        )
      }

      let hmac = request.headers.get(ShopifyHeader.Hmac.toLowerCase())
      let topic = request.headers.get(ShopifyHeader.Topic.toLowerCase())
      let domain = request.headers.get(ShopifyHeader.Domain.toLowerCase())

      const missingHeaders = []
      if (!hmac) {
        missingHeaders.push(ShopifyHeader.Hmac)
      }
      if (!topic) {
        missingHeaders.push(ShopifyHeader.Topic)
      }
      if (!domain) {
        missingHeaders.push(ShopifyHeader.Domain)
      }

      if (missingHeaders.length) {
        return resolve(
          new Response(null, {
            status    : StatusCode.BadRequest,
            statusText: `Missing one or more of the required HTTP headers to process webhooks: [${ missingHeaders.join(
              ", ",
            ) }]`
          })
        )
      }

      let responseError: Error | undefined

      const generatedHash = createHmac("sha256", config.API_SECRET_KEY)
        .update(body, "utf8")
        .digest("base64")

      if (ShopifyUtilities.safeCompare(generatedHash, hmac as string)) {
        const graphqlTopic = (topic as string)
          .toUpperCase()
          .replace(/\//g, "_")
        const webhookEntry = WebhooksRegistry.getHandler(graphqlTopic)

        if (webhookEntry) {
          try {
            await webhookEntry.webhookHandler(
              graphqlTopic,
              domain as string,
              body,
            )
          } catch (error) {
            responseError = error
          }
        } else {
          responseError = new ShopifyErrors.InvalidWebhookError(
            `No webhook is registered for topic ${ topic }`,
          )
        }
      } else {
        responseError = new ShopifyErrors.InvalidWebhookError(
          `Could not validate request for topic ${ topic }`,
        )
      }

      if (responseError) {
        return reject(responseError)
      } else {
        return resolve(new Response(JSON.stringify({}), {
          status: 200
        }))
      }
    })

    return promise
  },

  isWebhookPath (path: string): boolean {
    for (const key in WebhooksRegistry.webhookRegistry) {
      if (WebhooksRegistry.webhookRegistry[key].path === path) {
        return true
      }
    }
    return false
  },
}

export { WebhooksRegistry, RegistryInterface, buildCheckQuery, buildQuery }
