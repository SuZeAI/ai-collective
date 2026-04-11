import asyncio
import json
import logging
from typing import Callable, Any

import aio_pika
from backend.api.settings import settings

logger = logging.getLogger(__name__)

class RabbitMQEventBus:
    def __init__(self):
        self.url = settings.rabbitmq_url
        self.max_workers = settings.rabbitmq_max_workers
        self.connection: aio_pika.RobustConnection | None = None
        self.channel: aio_pika.RobustChannel | None = None
        self.exchange: aio_pika.RobustExchange | None = None
        self.semaphore: asyncio.Semaphore | None = None

    async def connect(self):
        try:
            self.connection = await aio_pika.connect_robust(self.url)
            self.channel = await self.connection.channel()
            # We use a topic exchange to route events generically
            self.exchange = await self.channel.declare_exchange("ai_collective_events", aio_pika.ExchangeType.TOPIC)
            self.semaphore = asyncio.Semaphore(self.max_workers)
            logger.info("Connected to RabbitMQ Event Bus")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ Event Bus: {e}")

    async def disconnect(self):
        if self.connection:
            await self.connection.close()
            logger.info("Disconnected from RabbitMQ")

    async def publish(self, event_name: str, payload: dict):
        if not self.exchange:
            logger.warning("EventBus is not connected. Cannot publish message.")
            return

        message = aio_pika.Message(
            body=json.dumps(payload).encode(),
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT
        )
        await self.exchange.publish(message, routing_key=event_name)
        logger.debug(f"Published event '{event_name}'")

    async def subscribe(self, event_name: str, handler: Callable[[dict], Any]):
        if not self.channel or not self.exchange or not self.semaphore:
            logger.warning("EventBus is not connected. Cannot subscribe.")
            return

        # Queue specifically for this event type
        queue_name = f"queue_{event_name.replace('.', '_')}"
        queue = await self.channel.declare_queue(queue_name, durable=True)
        await queue.bind(self.exchange, routing_key=event_name)

        async def process_message(message: aio_pika.IncomingMessage):
            async with message.process():
                # Acquire semaphore to bound concurrency
                async with self.semaphore:
                    try:
                        payload = json.loads(message.body.decode())
                        logger.info(f"Handling event '{event_name}'")
                        await handler(payload)
                    except Exception as e:
                        logger.error(f"Error handling event '{event_name}': {e}", exc_info=True)

        await queue.consume(process_message)
        logger.info(f"Subscribed to event '{event_name}' on queue '{queue_name}'")

event_bus = RabbitMQEventBus()
