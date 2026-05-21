.PHONY: up down logs backend-logs worker-logs beat-logs redis-cli shell worker-shell flower migrate test-email purge-queues

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

backend-logs:
	docker compose logs -f backend

worker-logs:
	docker compose logs -f celery_worker

beat-logs:
	docker compose logs -f celery_beat

redis-cli:
	docker compose exec redis redis-cli

shell:
	docker compose exec backend bash

worker-shell:
	docker compose exec celery_worker bash

flower:
	@echo "Flower UI: http://localhost:5555"

migrate:
	docker compose exec backend python -c "from app.database import init_db; init_db()"

test-email:
	docker compose exec backend python -c "from app.tasks.email_tasks import send_email; send_email.delay('test@example.com', 'Test', 'Hello')"

purge-queues:
	docker compose exec celery_worker celery -A app.celery_app purge -f
